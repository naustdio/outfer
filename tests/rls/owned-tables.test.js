// Task 12.2 (+ closes verify-report-pr4.md's flagged gap: "no two-user
// runtime proof until task 12.4 lands" -- actually landed here in 12.2,
// since per-table isolation belongs next to per-table anon-zero-access).
//
// Non-tautology note (Strict TDD, RED-equivalent reasoning for an
// integration suite): these assertions are NOT vacuous. If 0004_rls.sql's
// `owner_all` policies were commented out, "owner SELECT/UPDATE" would
// fail (RLS would deny everyone, including the owner) and "two-user
// isolation" would trivially pass for the wrong reason (nobody sees
// anything) while "anon SELECT/INSERT/UPDATE/DELETE" would still pass
// because the anon-side grants (0002/0003) are independently absent. The
// owner-success assertions are what makes this a REAL RLS proof rather
// than a "nothing works" false positive -- verified manually against this
// exact schema before writing this file (see apply-progress for the
// before/after run against a temporarily-reverted 0004_rls.sql).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabaseEnv,
  assertConnected,
  makeAdminClient,
  makeAnonClient,
  createTestUser,
  deleteTestUser,
  getAnyTipoPrendaId,
  insertPrenda,
  insertOutfit,
  insertTip,
  cleanupUserRows,
} from "./setup.js";

describe.skipIf(!hasSupabaseEnv)("Owned-table RLS: prenda/outfit/tip + 3 join tables", () => {
  const admin = makeAdminClient();
  const anon = makeAnonClient();
  let userA;
  let userB;
  let tipoPrendaId;
  const fx = {};

  beforeAll(async () => {
    await assertConnected(admin);
    tipoPrendaId = await getAnyTipoPrendaId(admin);
    [userA, userB] = await Promise.all([
      createTestUser(admin, "owned-a"),
      createTestUser(admin, "owned-b"),
    ]);

    for (const [label, user] of [
      ["A", userA],
      ["B", userB],
    ]) {
      const prenda = await insertPrenda(admin, user.id, tipoPrendaId, {
        nombre: `owned-table fixture ${label}`,
      });
      const outfit = await insertOutfit(admin, user.id, { titulo: `owned-table fixture ${label}` });
      const tip = await insertTip(admin, user.id, { tip: `owned-table fixture ${label}` });
      const { error: opErr } = await admin
        .from("outfit_prenda")
        .insert({ user_id: user.id, outfit_id: outfit.id, prenda_id: prenda.id });
      if (opErr) throw opErr;
      const { error: ptErr } = await admin
        .from("prenda_tip")
        .insert({ user_id: user.id, prenda_id: prenda.id, tip_id: tip.id });
      if (ptErr) throw ptErr;
      const { error: otErr } = await admin
        .from("outfit_tip")
        .insert({ user_id: user.id, outfit_id: outfit.id, tip_id: tip.id });
      if (otErr) throw otErr;
      fx[label] = { prenda, outfit, tip };
    }
  });

  afterAll(async () => {
    await cleanupUserRows(admin, userA?.id);
    await cleanupUserRows(admin, userB?.id);
    await deleteTestUser(admin, userA?.id);
    await deleteTestUser(admin, userB?.id);
  });

  const entityTables = [
    {
      name: "prenda",
      idOf: (l) => fx[l].prenda.id,
      insertPayload: () => ({
        user_id: userA.id,
        nombre: "anon-insert-attempt",
        categoria: "Superior",
        tipo_prenda_id: tipoPrendaId,
        colores: ["Negro"],
        fecha_ingreso: "2026-01-01",
      }),
      patch: { nombre: "anon-write-attempt" },
    },
    {
      name: "outfit",
      idOf: (l) => fx[l].outfit.id,
      insertPayload: () => ({ user_id: userA.id, titulo: "anon-insert-attempt" }),
      patch: { titulo: "anon-write-attempt" },
    },
    {
      name: "tip",
      idOf: (l) => fx[l].tip.id,
      insertPayload: () => ({ user_id: userA.id, tip: "anon-insert-attempt" }),
      patch: { tip: "anon-write-attempt" },
    },
  ];

  describe.each(entityTables)("$name", ({ name, idOf, insertPayload, patch }) => {
    it("anon SELECT returns 0 rows for an existing row", async () => {
      const { data, error } = await anon.from(name).select("id").eq("id", idOf("A"));
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("anon INSERT is rejected", async () => {
      const { error } = await anon.from(name).insert(insertPayload());
      expect(error).not.toBeNull();
    });

    it("anon UPDATE affects 0 rows; the row is unchanged", async () => {
      const { error, data } = await anon.from(name).update(patch).eq("id", idOf("A")).select();
      if (!error) expect(data).toHaveLength(0);
      const [key, value] = Object.entries(patch)[0];
      const { data: check } = await admin.from(name).select("*").eq("id", idOf("A")).single();
      expect(check[key]).not.toBe(value);
    });

    it("anon DELETE affects 0 rows; the row still exists", async () => {
      const { error, data } = await anon.from(name).delete().eq("id", idOf("A")).select();
      if (!error) expect(data).toHaveLength(0);
      const { data: check, error: checkErr } = await admin
        .from(name)
        .select("id")
        .eq("id", idOf("A"))
        .maybeSingle();
      expect(checkErr).toBeNull();
      expect(check).not.toBeNull();
    });

    it("owner can SELECT and UPDATE their own row (FOR ALL policy)", async () => {
      const { data: sel, error: selErr } = await userA.client.from(name).select("id").eq("id", idOf("A"));
      expect(selErr).toBeNull();
      expect(sel).toHaveLength(1);

      const { error: updErr } = await userA.client.from(name).update(patch).eq("id", idOf("A"));
      expect(updErr).toBeNull();
      const [key, value] = Object.entries(patch)[0];
      const { data: reread } = await admin.from(name).select("*").eq("id", idOf("A")).single();
      expect(reread[key]).toBe(value);
    });

    it("two-user isolation: user A cannot see or affect user B's row, and vice versa", async () => {
      const { data: aSeesB } = await userA.client.from(name).select("id").eq("id", idOf("B"));
      expect(aSeesB).toHaveLength(0);
      const { data: bSeesA } = await userB.client.from(name).select("id").eq("id", idOf("A"));
      expect(bSeesA).toHaveLength(0);

      const { error: aUpdErr, data: aUpdData } = await userA.client
        .from(name)
        .update(patch)
        .eq("id", idOf("B"))
        .select();
      if (!aUpdErr) expect(aUpdData).toHaveLength(0);
    });
  });

  const joinTables = [
    {
      name: "outfit_prenda",
      keyOf: (l) => ({ outfit_id: fx[l].outfit.id, prenda_id: fx[l].prenda.id }),
    },
    {
      name: "prenda_tip",
      keyOf: (l) => ({ prenda_id: fx[l].prenda.id, tip_id: fx[l].tip.id }),
    },
    {
      name: "outfit_tip",
      keyOf: (l) => ({ outfit_id: fx[l].outfit.id, tip_id: fx[l].tip.id }),
    },
  ];

  function withKeys(query, key) {
    let q = query;
    for (const [k, v] of Object.entries(key)) q = q.eq(k, v);
    return q;
  }

  describe.each(joinTables)("$name", ({ name, keyOf }) => {
    it("anon SELECT returns 0 rows for an existing link", async () => {
      const { data, error } = await withKeys(anon.from(name).select("*"), keyOf("A"));
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("anon INSERT is rejected", async () => {
      const { error } = await anon.from(name).insert({ user_id: userA.id, ...keyOf("A") });
      expect(error).not.toBeNull();
    });

    it("anon DELETE affects 0 rows; the link still exists", async () => {
      const { error, data } = await withKeys(anon.from(name).delete(), keyOf("A")).select();
      if (!error) expect(data).toHaveLength(0);
      const { data: check } = await withKeys(admin.from(name).select("*"), keyOf("A"));
      expect(check).toHaveLength(1);
    });

    it("owner can SELECT their own link row", async () => {
      const { data, error } = await withKeys(userA.client.from(name).select("*"), keyOf("A"));
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("two-user isolation: user A cannot see user B's link row", async () => {
      const { data } = await withKeys(userA.client.from(name).select("*"), keyOf("B"));
      expect(data).toHaveLength(0);
    });
  });
});
