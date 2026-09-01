// RED (task 2.4) -> GREEN (task 2.5): proves the security posture itself is
// test-driven. Written against a schema that has tables (0001-0003 applied)
// but RLS not yet enabled — the anon client can read rows it must never see.
// After 0004_rls.sql enables RLS + owner_all policies, this test flips green.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "./_env.js";

describe.skipIf(!hasSupabaseEnv)("pre-RLS anon leak (prenda/outfit/tip)", () => {
  const admin = hasSupabaseEnv
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
  const anon = hasSupabaseEnv
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  let ownerId;
  let tipoPrendaId;

  beforeAll(async () => {
    const email = `rls-anon-leak-${Date.now()}@example.test`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true,
    });
    if (userError) throw userError;
    ownerId = userData.user.id;

    const { data: tipo, error: tipoError } = await admin
      .from("tipo_prenda")
      .select("id")
      .limit(1)
      .single();
    if (tipoError) throw tipoError;
    tipoPrendaId = tipo.id;

    const { error: insertError } = await admin.from("prenda").insert({
      user_id: ownerId,
      nombre: "RLS leak fixture",
      categoria: "Superior",
      tipo_prenda_id: tipoPrendaId,
      colores: ["Negro"],
      fecha_ingreso: "2026-01-01",
    });
    if (insertError) throw insertError;
  });

  afterAll(async () => {
    if (!ownerId) return;
    await admin.from("prenda").delete().eq("user_id", ownerId);
    await admin.auth.admin.deleteUser(ownerId);
  });

  it("anon client reads 0 rows from prenda", async () => {
    const { data, error } = await anon.from("prenda").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("anon client reads 0 rows from outfit", async () => {
    const { data, error } = await anon.from("outfit").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("anon client reads 0 rows from tip", async () => {
    const { data, error } = await anon.from("tip").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
