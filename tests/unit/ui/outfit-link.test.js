// outfit-composition "Outfit CRUD and Garment Linking" + design.md "Refetch
// after mutation instead of client-side re-derivation": linking/unlinking a
// garment must go through linksRepo then REFETCH outfit_v via
// outfitsRepo.getWithPrendas() -- estado/nombre_sugerido must never be
// recomputed in JS. These handlers are extracted as plain functions (same
// convention as prenda-form.js's readPrendaFormValues/sanitize/validate)
// specifically so this refetch-not-recompute contract is unit testable
// without a DOM/jsdom environment.
import { describe, it, expect } from "vitest";
import { handleLinkGarment, handleUnlinkGarment } from "../../../src/ui/screens/outfit-detail.js";

function makeFakeLinksRepo() {
  const calls = [];
  return {
    calls,
    linkOutfitPrenda: (outfitId, prendaId) => {
      calls.push(["link", outfitId, prendaId]);
      return Promise.resolve(true);
    },
    unlinkOutfitPrenda: (outfitId, prendaId) => {
      calls.push(["unlink", outfitId, prendaId]);
      return Promise.resolve(true);
    },
  };
}

function makeFakeOutfitsRepo(refetchResult) {
  const calls = [];
  return {
    calls,
    getWithPrendas: (id) => {
      calls.push(["getWithPrendas", id]);
      return Promise.resolve(refetchResult);
    },
  };
}

describe("handleLinkGarment", () => {
  it("links then refetches outfit_v via getWithPrendas (no client-side recompute)", async () => {
    const linksRepo = makeFakeLinksRepo();
    const refetched = { outfit: { id: "o1", estado: "Disponible" }, prendaIds: ["p1"] };
    const outfitsRepo = makeFakeOutfitsRepo(refetched);

    const result = await handleLinkGarment({ outfitsRepo, linksRepo, outfitId: "o1", prendaId: "p1" });

    expect(linksRepo.calls).toEqual([["link", "o1", "p1"]]);
    expect(outfitsRepo.calls).toEqual([["getWithPrendas", "o1"]]);
    expect(result).toBe(refetched);
  });

  it("refetches only after the link write resolves (ordering matters for a real DB round trip)", async () => {
    const order = [];
    const linksRepo = {
      linkOutfitPrenda: async () => {
        order.push("link");
      },
    };
    const outfitsRepo = {
      getWithPrendas: async () => {
        order.push("refetch");
        return { outfit: {}, prendaIds: [] };
      },
    };

    await handleLinkGarment({ outfitsRepo, linksRepo, outfitId: "o1", prendaId: "p1" });

    expect(order).toEqual(["link", "refetch"]);
  });
});

describe("handleUnlinkGarment", () => {
  it("unlinks then refetches outfit_v via getWithPrendas (no client-side recompute)", async () => {
    const linksRepo = makeFakeLinksRepo();
    const refetched = { outfit: { id: "o1", estado: "Sin prendas" }, prendaIds: [] };
    const outfitsRepo = makeFakeOutfitsRepo(refetched);

    const result = await handleUnlinkGarment({ outfitsRepo, linksRepo, outfitId: "o1", prendaId: "p1" });

    expect(linksRepo.calls).toEqual([["unlink", "o1", "p1"]]);
    expect(outfitsRepo.calls).toEqual([["getWithPrendas", "o1"]]);
    expect(result).toBe(refetched);
  });
});
