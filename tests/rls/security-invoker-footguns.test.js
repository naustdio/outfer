// Task 12.4: the two `security_invoker` footguns design.md calls out as the
// single highest-risk item in this change -- a plain (definer-style) view or
// a `SECURITY DEFINER` function would silently bypass RLS and leak every
// row to any caller. `outfit_v` (`with (security_invoker = on)`) and
// `search_all()` (`security invoker`) are BOTH already covered once, in
// isolation, by pre-rls-anon-leak.test.js's spirit at the table level --
// this file is the comprehensive proof at the view/RPC level itself, plus
// the positive (owner-sees-own-data) half that a footgun-only test would
// never catch (a fully-broken RPC that always returns nothing would also
// pass an anon-only assertion).
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
  cleanupUserRows,
} from "./setup.js";

describe.skipIf(!hasSupabaseEnv)("security_invoker footguns: outfit_v view and search_all() RPC", () => {
  const admin = makeAdminClient();
  const anon = makeAnonClient();
  let user;
  let prenda;
  let outfit;

  beforeAll(async () => {
    await assertConnected(admin);
    const tipoPrendaId = await getAnyTipoPrendaId(admin);
    user = await createTestUser(admin, "invoker");
    prenda = await insertPrenda(admin, user.id, tipoPrendaId, {
      nombre: "invoker-footgun searchable-marca",
    });
    outfit = await insertOutfit(admin, user.id, { titulo: "invoker-footgun searchable-outfit" });
    const { error } = await admin
      .from("outfit_prenda")
      .insert({ user_id: user.id, outfit_id: outfit.id, prenda_id: prenda.id });
    if (error) throw error;
  });

  afterAll(async () => {
    await cleanupUserRows(admin, user?.id);
    await deleteTestUser(admin, user?.id);
  });

  it("outfit_v: authenticated owner sees their own outfit row through the view", async () => {
    const { data, error } = await user.client.from("outfit_v").select("id, estado").eq("id", outfit.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("outfit_v: anon SELECT returns 0 rows -- security_invoker forces RLS on the underlying outfit table", async () => {
    const { data, error } = await anon.from("outfit_v").select("id").eq("id", outfit.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("search_all: authenticated owner's RPC call finds their own rows", async () => {
    const { data, error } = await user.client.rpc("search_all", { q: "invoker-footgun" });
    expect(error).toBeNull();
    expect(data.some((hit) => hit.id === prenda.id)).toBe(true);
    expect(data.some((hit) => hit.id === outfit.id)).toBe(true);
  });

  it("search_all: anon RPC call returns 0 rows -- security invoker forces RLS inside the function body", async () => {
    const { data, error } = await anon.rpc("search_all", { q: "invoker-footgun" });
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
