// verify-report-pr5-fixpass WARNING-1: the first version of this test used
// one tip attached to TWO OUTFITS, which only proves row independence
// within the same join table (outfit_tip). openspec/specs/styling-tips/
// spec.md's actual scenario is CROSS-table: "a tip attached to both an
// outfit and a garment, detach it from the garment only, the outfit
// attachment survives" -- i.e. independence between prenda_tip and
// outfit_tip, two DIFFERENT join tables. This proves that scenario, against
// the real local Supabase stack: attach ONE tip to one outfit AND one
// garment via the REAL linksRepo (src/data/links.js, an authenticated
// client -- the same repo src/ui/screens/tip-form.js's
// handleAttachOutfit/handleAttachGarment call, not a fake and not the
// RLS-bypassing admin client), detach it from the garment only, then assert
// via a real admin query that the outfit_tip row still exists untouched.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeLinksRepo } from "../../src/data/links.js";
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

describe.skipIf(!hasSupabaseEnv)(
  "Dual attachment independence: detaching a tip from a garment leaves its outfit attachment intact",
  () => {
    const admin = makeAdminClient();
    let user;
    let outfit;
    let prenda;
    let tip;

    beforeAll(async () => {
      await assertConnected(admin);
      user = await createTestUser(admin, "dual-attach");
      const tipoPrendaId = await getAnyTipoPrendaId(admin);
      [outfit, prenda, tip] = await Promise.all([
        insertOutfit(admin, user.id, { titulo: "dual-attach fixture outfit" }),
        insertPrenda(admin, user.id, tipoPrendaId, { nombre: "dual-attach fixture prenda" }),
        insertTip(admin, user.id, { tip: "dual-attach fixture tip" }),
      ]);
    });

    afterAll(async () => {
      await cleanupUserRows(admin, user?.id);
      await deleteTestUser(admin, user?.id);
    });

    it("attaching one tip to an outfit AND a garment, then detaching the garment only, leaves the outfit's join row intact", async () => {
      // Real linksRepo through the real authenticated user client -- the
      // same repo src/ui/screens/tip-form.js's handleAttachOutfit/
      // handleAttachGarment/handleDetachGarment call.
      const linksRepo = makeLinksRepo(user.client);

      await linksRepo.linkOutfitTip(outfit.id, tip.id);
      await linksRepo.linkPrendaTip(prenda.id, tip.id);

      // Precondition: both rows genuinely exist, in their own separate
      // join tables, before detaching anything.
      const [{ data: outfitRowsBefore, error: outfitBeforeError }, { data: prendaRowsBefore, error: prendaBeforeError }] =
        await Promise.all([
          admin.from("outfit_tip").select("outfit_id, tip_id").eq("tip_id", tip.id),
          admin.from("prenda_tip").select("prenda_id, tip_id").eq("tip_id", tip.id),
        ]);
      expect(outfitBeforeError).toBeNull();
      expect(prendaBeforeError).toBeNull();
      expect(outfitRowsBefore).toHaveLength(1);
      expect(prendaRowsBefore).toHaveLength(1);

      await linksRepo.unlinkPrendaTip(prenda.id, tip.id);

      const { data: afterDetach, error: detachedError } = await admin
        .from("prenda_tip")
        .select("prenda_id, tip_id")
        .eq("prenda_id", prenda.id)
        .eq("tip_id", tip.id);
      expect(detachedError).toBeNull();
      expect(afterDetach).toHaveLength(0);

      // The load-bearing assertion: the outfit's row, in a DIFFERENT join
      // table (outfit_tip, not prenda_tip), survives untouched -- read
      // directly from the database, not inferred from the app's own
      // refetch and not asserted against a fake.
      const { data: survivorRow, error: survivorError } = await admin
        .from("outfit_tip")
        .select("outfit_id, tip_id")
        .eq("outfit_id", outfit.id)
        .eq("tip_id", tip.id);
      expect(survivorError).toBeNull();
      expect(survivorRow).toHaveLength(1);
    });
  },
);
