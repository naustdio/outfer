// Task 12.5: design.md's "denormalize user_id onto join tables + composite
// FK" decision exists specifically so a cross-user link is STRUCTURALLY
// impossible, not merely RLS-prohibited. Proves that distinction directly:
// the admin (service-role) client BYPASSES RLS entirely, so if these
// inserts were rejected only by RLS, admin would succeed. It doesn't --
// the composite FK `(outfit_id, user_id) references outfit(id, user_id)`
// (etc.) rejects the row regardless of RLS, with a foreign_key_violation
// (Postgres error code 23503), not a permission error.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabaseEnv,
  assertConnected,
  makeAdminClient,
  createTestUser,
  deleteTestUser,
  getAnyTipoPrendaId,
  insertPrenda,
  insertOutfit,
  insertTip,
  cleanupUserRows,
} from "./setup.js";

describe.skipIf(!hasSupabaseEnv)("Composite-FK cross-tenant guard: cross-user links are structurally impossible", () => {
  const admin = makeAdminClient();
  let userA;
  let userB;
  let prendaA;
  let outfitA;
  let tipA;
  let prendaB;
  let outfitB;
  let tipB;

  beforeAll(async () => {
    await assertConnected(admin);
    const tipoPrendaId = await getAnyTipoPrendaId(admin);
    [userA, userB] = await Promise.all([createTestUser(admin, "fk-a"), createTestUser(admin, "fk-b")]);
    [prendaA, outfitA, tipA] = await Promise.all([
      insertPrenda(admin, userA.id, tipoPrendaId, { nombre: "fk-guard fixture A" }),
      insertOutfit(admin, userA.id, { titulo: "fk-guard fixture A" }),
      insertTip(admin, userA.id, { tip: "fk-guard fixture A" }),
    ]);
    [prendaB, outfitB, tipB] = await Promise.all([
      insertPrenda(admin, userB.id, tipoPrendaId, { nombre: "fk-guard fixture B" }),
      insertOutfit(admin, userB.id, { titulo: "fk-guard fixture B" }),
      insertTip(admin, userB.id, { tip: "fk-guard fixture B" }),
    ]);
  });

  afterAll(async () => {
    await cleanupUserRows(admin, userA?.id);
    await cleanupUserRows(admin, userB?.id);
    await deleteTestUser(admin, userA?.id);
    await deleteTestUser(admin, userB?.id);
  });

  it("admin (RLS-bypassing service role) cannot link user A's outfit to user B's prenda: FK rejects, not RLS", async () => {
    const { error } = await admin
      .from("outfit_prenda")
      .insert({ user_id: userA.id, outfit_id: outfitA.id, prenda_id: prendaB.id });
    expect(error).not.toBeNull();
    expect(error.code).toBe("23503");
  });

  it("admin cannot link user A's prenda to user B's tip via prenda_tip: FK rejects", async () => {
    const { error } = await admin
      .from("prenda_tip")
      .insert({ user_id: userA.id, prenda_id: prendaA.id, tip_id: tipB.id });
    expect(error).not.toBeNull();
    expect(error.code).toBe("23503");
  });

  it("admin cannot link user A's outfit to user B's tip via outfit_tip: FK rejects", async () => {
    const { error } = await admin
      .from("outfit_tip")
      .insert({ user_id: userA.id, outfit_id: outfitA.id, tip_id: tipB.id });
    expect(error).not.toBeNull();
    expect(error.code).toBe("23503");
  });

  it("a real authenticated user A session also cannot forge this link (same FK, realistic client path)", async () => {
    const { error } = await userA.client
      .from("outfit_prenda")
      .insert({ user_id: userA.id, outfit_id: outfitA.id, prenda_id: prendaB.id });
    expect(error).not.toBeNull();
  });

  it("the impossible link never exists afterward, confirmed via admin", async () => {
    const { data } = await admin
      .from("outfit_prenda")
      .select("*")
      .eq("outfit_id", outfitA.id)
      .eq("prenda_id", prendaB.id);
    expect(data).toHaveLength(0);
  });
});
