// verify-report-pr5 WARNING-1 (carried over as part of the whole-change
// CRITICAL-3 gap): the only existing coverage for styling-tips "Detach from
// one relation leaves the other intact" is tests/unit/ui/tip-attach.test.js,
// which injects FAKE repos and asserts call shapes only -- never proves the
// real database behavior. This proves it against the real local Supabase
// stack: attach ONE tip to TWO outfits via the REAL linksRepo
// (src/data/links.js, an authenticated client -- the same repo the app
// itself uses, not the admin/service-role client), detach it from one
// outfit, then assert via a real admin query that the OTHER outfit_tip
// join-table row still exists untouched. outfit_tip's primary key is
// (outfit_id, tip_id) (0003_joins.sql), so a single tip CAN legitimately
// link to more than one outfit -- this is exactly the shape that proves row
// independence within the same join table.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeLinksRepo } from "../../src/data/links.js";
import {
  hasSupabaseEnv,
  assertConnected,
  makeAdminClient,
  createTestUser,
  deleteTestUser,
  insertOutfit,
  insertTip,
  cleanupUserRows,
} from "./setup.js";

describe.skipIf(!hasSupabaseEnv)(
  "Dual attachment independence: detaching one outfit_tip row leaves the other outfit's row intact",
  () => {
    const admin = makeAdminClient();
    let user;
    let outfitOne;
    let outfitTwo;
    let tip;

    beforeAll(async () => {
      await assertConnected(admin);
      user = await createTestUser(admin, "dual-attach");
      [outfitOne, outfitTwo, tip] = await Promise.all([
        insertOutfit(admin, user.id, { titulo: "dual-attach fixture outfit 1" }),
        insertOutfit(admin, user.id, { titulo: "dual-attach fixture outfit 2" }),
        insertTip(admin, user.id, { tip: "dual-attach fixture tip" }),
      ]);
    });

    afterAll(async () => {
      await cleanupUserRows(admin, user?.id);
      await deleteTestUser(admin, user?.id);
    });

    it("attaching the same tip to two outfits, then detaching one, leaves the other's join row intact", async () => {
      // Real linksRepo through the real authenticated user client -- the
      // same repo src/ui/screens/tip-form.js's handleAttachOutfit/
      // handleDetachOutfit call, not a fake and not the RLS-bypassing admin
      // client.
      const linksRepo = makeLinksRepo(user.client);

      await linksRepo.linkOutfitTip(outfitOne.id, tip.id);
      await linksRepo.linkOutfitTip(outfitTwo.id, tip.id);

      // Precondition: both rows genuinely exist before detaching anything.
      const { data: beforeRows, error: beforeError } = await admin
        .from("outfit_tip")
        .select("outfit_id, tip_id")
        .eq("tip_id", tip.id);
      expect(beforeError).toBeNull();
      expect(beforeRows).toHaveLength(2);

      await linksRepo.unlinkOutfitTip(outfitOne.id, tip.id);

      const { data: afterDetachOne, error: detachedError } = await admin
        .from("outfit_tip")
        .select("outfit_id, tip_id")
        .eq("outfit_id", outfitOne.id)
        .eq("tip_id", tip.id);
      expect(detachedError).toBeNull();
      expect(afterDetachOne).toHaveLength(0);

      // The load-bearing assertion: outfitTwo's row survives, untouched,
      // read directly from the database (not inferred from the app's own
      // refetch, and not asserted against a fake).
      const { data: survivorRow, error: survivorError } = await admin
        .from("outfit_tip")
        .select("outfit_id, tip_id")
        .eq("outfit_id", outfitTwo.id)
        .eq("tip_id", tip.id);
      expect(survivorError).toBeNull();
      expect(survivorRow).toHaveLength(1);
    });
  },
);
