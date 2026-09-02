// Task 12.6: derived-value correctness, read back through an AUTHENTICATED
// (not admin/service-role, not anon) client -- the exact access path the
// real app uses. Earlier ad-hoc verification of `outfit_v`/`disponible`
// during PR1/PR2 used service-role queries, which never exercise RLS at
// all; this closes that gap for the derivation logic itself.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabaseEnv,
  assertConnected,
  makeAdminClient,
  createTestUser,
  deleteTestUser,
  insertPrenda,
  insertOutfit,
  cleanupUserRows,
} from "./setup.js";

describe.skipIf(!hasSupabaseEnv)("Derived values via outfit_v and prenda.disponible, read via an authenticated client", () => {
  const admin = makeAdminClient();
  let user;
  let tipos; // 3 distinct tipo_prenda rows, strictly increasing `orden`, no ties.

  beforeAll(async () => {
    await assertConnected(admin);
    user = await createTestUser(admin, "derived");
    const { data, error } = await admin
      .from("tipo_prenda")
      .select("id, nombre, orden")
      .order("orden", { ascending: true })
      .limit(3);
    if (error) throw error;
    tipos = data;
  });

  afterAll(async () => {
    await cleanupUserRows(admin, user?.id);
    await deleteTestUser(admin, user?.id);
  });

  async function makeOutfitWithGarments(estados) {
    const outfit = await insertOutfit(admin, user.id, { titulo: `derived fixture ${Date.now()}-${Math.random()}` });
    for (let i = 0; i < estados.length; i += 1) {
      const tipo = tipos[i % tipos.length];
      const prenda = await insertPrenda(admin, user.id, tipo.id, {
        nombre: `derived fixture garment ${i}`,
        estado: estados[i],
      });
      const { error } = await admin
        .from("outfit_prenda")
        .insert({ user_id: user.id, outfit_id: outfit.id, prenda_id: prenda.id });
      if (error) throw error;
    }
    return outfit;
  }

  it("estado is 'Sin prendas' for an outfit with 0 linked garments", async () => {
    const outfit = await insertOutfit(admin, user.id, { titulo: "derived fixture empty" });
    const { data, error } = await user.client
      .from("outfit_v")
      .select("estado, nombre_sugerido")
      .eq("id", outfit.id)
      .single();
    expect(error).toBeNull();
    expect(data.estado).toBe("Sin prendas");
    expect(data.nombre_sugerido).toBeNull();
  });

  it("estado is 'Disponible' when every linked garment is 'En closet'", async () => {
    const outfit = await makeOutfitWithGarments(["En closet", "En closet"]);
    const { data, error } = await user.client.from("outfit_v").select("estado").eq("id", outfit.id).single();
    expect(error).toBeNull();
    expect(data.estado).toBe("Disponible");
  });

  it("estado is 'Incompleto' when garments are a mix of 'En closet' and 'Por comprar'", async () => {
    const outfit = await makeOutfitWithGarments(["En closet", "Por comprar"]);
    const { data, error } = await user.client.from("outfit_v").select("estado").eq("id", outfit.id).single();
    expect(error).toBeNull();
    expect(data.estado).toBe("Incompleto");
  });

  it("nombre_sugerido lists distinct tipo_prenda names in orden order", async () => {
    // 4 garments cycling through 3 distinct tipos proves de-duplication too.
    const outfit = await makeOutfitWithGarments(["En closet", "En closet", "En closet", "En closet"]);
    const { data, error } = await user.client.from("outfit_v").select("nombre_sugerido").eq("id", outfit.id).single();
    expect(error).toBeNull();
    const expected = tipos.map((t) => t.nombre).join(" + ");
    expect(data.nombre_sugerido).toBe(expected);
  });

  it("a direct UPDATE of prenda.disponible is rejected -- generated column has no write path", async () => {
    const prenda = await insertPrenda(admin, user.id, tipos[0].id, {
      nombre: "derived fixture disponible-write-attempt",
    });
    const { error } = await user.client.from("prenda").update({ disponible: false }).eq("id", prenda.id);
    expect(error).not.toBeNull();
  });
});
