// styling-tips "Dual Attachment" + "Detach from one relation leaves the
// other intact": the outfit-side (outfit_tip) and garment-side (prenda_tip)
// attachments are independent join tables -- detaching one must not touch
// the other. Extracted as plain functions (same convention as
// outfit-detail.js's handleLinkGarment/handleUnlinkGarment) so this is unit
// testable without a DOM/jsdom environment.
import { describe, it, expect } from "vitest";
import {
  handleAttachOutfit,
  handleDetachOutfit,
  handleAttachPrenda,
  handleDetachPrenda,
} from "../../../src/ui/screens/tip-form.js";

function makeFakeLinksRepo() {
  const calls = [];
  return {
    calls,
    linkOutfitTip: (outfitId, tipId) => (calls.push(["linkOutfitTip", outfitId, tipId]), Promise.resolve(true)),
    unlinkOutfitTip: (outfitId, tipId) =>
      (calls.push(["unlinkOutfitTip", outfitId, tipId]), Promise.resolve(true)),
    linkPrendaTip: (prendaId, tipId) => (calls.push(["linkPrendaTip", prendaId, tipId]), Promise.resolve(true)),
    unlinkPrendaTip: (prendaId, tipId) =>
      (calls.push(["unlinkPrendaTip", prendaId, tipId]), Promise.resolve(true)),
  };
}

function makeFakeTipsRepo(refetchResult) {
  const calls = [];
  return {
    calls,
    getById: (id) => {
      calls.push(["getById", id]);
      return Promise.resolve(refetchResult);
    },
  };
}

describe("handleAttachOutfit / handleAttachPrenda", () => {
  it("attaches to an outfit then refetches via tipsRepo.getById", async () => {
    const linksRepo = makeFakeLinksRepo();
    const refetched = { tip: { id: "t1" }, outfits: [{ outfit_id: "o1" }], prendas: [] };
    const tipsRepo = makeFakeTipsRepo(refetched);

    const result = await handleAttachOutfit({ tipsRepo, linksRepo, tipId: "t1", outfitId: "o1" });

    expect(linksRepo.calls).toEqual([["linkOutfitTip", "o1", "t1"]]);
    expect(tipsRepo.calls).toEqual([["getById", "t1"]]);
    expect(result).toBe(refetched);
  });

  it("attaches to a garment then refetches via tipsRepo.getById", async () => {
    const linksRepo = makeFakeLinksRepo();
    const refetched = { tip: { id: "t1" }, outfits: [], prendas: [{ prenda_id: "p1" }] };
    const tipsRepo = makeFakeTipsRepo(refetched);

    const result = await handleAttachPrenda({ tipsRepo, linksRepo, tipId: "t1", prendaId: "p1" });

    expect(linksRepo.calls).toEqual([["linkPrendaTip", "p1", "t1"]]);
    expect(tipsRepo.calls).toEqual([["getById", "t1"]]);
    expect(result).toBe(refetched);
  });
});

describe("handleDetachOutfit / handleDetachPrenda -- one relation never touches the other", () => {
  it("detaching from the garment only calls unlinkPrendaTip, never outfit_tip", async () => {
    const linksRepo = makeFakeLinksRepo();
    const refetched = { tip: { id: "t1" }, outfits: [{ outfit_id: "o1" }], prendas: [] };
    const tipsRepo = makeFakeTipsRepo(refetched);

    const result = await handleDetachPrenda({ tipsRepo, linksRepo, tipId: "t1", prendaId: "p1" });

    expect(linksRepo.calls).toEqual([["unlinkPrendaTip", "p1", "t1"]]);
    expect(linksRepo.calls.some(([op]) => op === "unlinkOutfitTip")).toBe(false);
    // The refetch is the source of truth for what remains attached -- the
    // outfit attachment survives because the DB state, not any client-side
    // bookkeeping, still has it.
    expect(result.outfits).toEqual([{ outfit_id: "o1" }]);
    expect(result.prendas).toEqual([]);
  });

  it("detaching from the outfit only calls unlinkOutfitTip, never prenda_tip", async () => {
    const linksRepo = makeFakeLinksRepo();
    const refetched = { tip: { id: "t1" }, outfits: [], prendas: [{ prenda_id: "p1" }] };
    const tipsRepo = makeFakeTipsRepo(refetched);

    const result = await handleDetachOutfit({ tipsRepo, linksRepo, tipId: "t1", outfitId: "o1" });

    expect(linksRepo.calls).toEqual([["unlinkOutfitTip", "o1", "t1"]]);
    expect(linksRepo.calls.some(([op]) => op === "unlinkPrendaTip")).toBe(false);
    expect(result.outfits).toEqual([]);
    expect(result.prendas).toEqual([{ prenda_id: "p1" }]);
  });
});
