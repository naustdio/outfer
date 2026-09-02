// Task 12.3: colores / tipo_prenda are shared vocabulary, not owned data --
// they carry no `user_id` column and are read-only for `authenticated`
// (write-once-append-only for `tipo_prenda`). Confirms design.md's stated
// grant shape is still correct: RLS is enabled on both (0004_rls.sql) but
// `anon` gets zero access even though it holds a table-level SELECT grant
// (0001_types_and_lookups.sql) -- the grant only makes the table reachable,
// RLS is what filters rows to 0 for a role with no policy.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabaseEnv,
  assertConnected,
  makeAdminClient,
  makeAnonClient,
  createTestUser,
  deleteTestUser,
} from "./setup.js";

describe.skipIf(!hasSupabaseEnv)("Lookup tables (colores, tipo_prenda): shared vocabulary, not owned data", () => {
  const admin = makeAdminClient();
  const anon = makeAnonClient();
  let user;

  beforeAll(async () => {
    await assertConnected(admin);
    user = await createTestUser(admin, "lookup");
  });

  afterAll(async () => {
    await deleteTestUser(admin, user?.id);
  });

  describe("colores (fixed, no RLS-owner column -- correctly has no user_id)", () => {
    it("authenticated SELECT returns the seeded catalog", async () => {
      const { data, error } = await user.client.from("colores").select("valor");
      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it("anon SELECT returns 0 rows despite the table-level SELECT grant", async () => {
      const { data, error } = await anon.from("colores").select("valor");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("authenticated INSERT is rejected -- fixed enum-backed vocabulary, no grant at all", async () => {
      const { error } = await user.client
        .from("colores")
        .insert({ valor: "Negro", nombre: "x", hex: "#000000", orden: 1 });
      expect(error).not.toBeNull();
    });
  });

  describe("tipo_prenda (growable, append-only for authenticated)", () => {
    let insertedId;

    afterAll(async () => {
      if (insertedId) await admin.from("tipo_prenda").delete().eq("id", insertedId);
    });

    it("authenticated SELECT returns the seeded catalog", async () => {
      const { data, error } = await user.client.from("tipo_prenda").select("id");
      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it("anon SELECT returns 0 rows despite the table-level SELECT grant", async () => {
      const { data, error } = await anon.from("tipo_prenda").select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("authenticated INSERT is allowed -- growable vocabulary, no migration needed to extend", async () => {
      const { data, error } = await user.client
        .from("tipo_prenda")
        .insert({ nombre: `RLS test tipo ${Date.now()}`, categoria: "Superior", orden: 999 })
        .select()
        .single();
      expect(error).toBeNull();
      insertedId = data.id;
    });

    it("authenticated UPDATE is rejected -- append-only, no update grant", async () => {
      expect(insertedId).toBeTruthy();
      const { error } = await user.client.from("tipo_prenda").update({ orden: 1 }).eq("id", insertedId);
      expect(error).not.toBeNull();
    });

    it("authenticated DELETE is rejected -- append-only, no delete grant", async () => {
      expect(insertedId).toBeTruthy();
      const { error } = await user.client.from("tipo_prenda").delete().eq("id", insertedId);
      expect(error).not.toBeNull();
    });

    it("anon INSERT is rejected", async () => {
      const { error } = await anon.from("tipo_prenda").insert({ nombre: `anon ${Date.now()}`, categoria: "Superior" });
      expect(error).not.toBeNull();
    });
  });
});
