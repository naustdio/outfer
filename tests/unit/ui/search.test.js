// unified-search "Cross-Entity Search": groupSearchHits is the pure
// grouping logic behind src/ui/screens/search.js, extracted so it is unit
// testable without a DOM/jsdom environment -- same convention as
// outfit-detail.js's handleLinkGarment/handleUnlinkGarment and
// tip-form.js's handleAttach*/handleDetach* (see their header comments).
// design.md's Interfaces/Contracts section: "UI groups by `tipo`; the RPC
// never has to know about grouping."
import { describe, it, expect } from "vitest";
import { groupSearchHits } from "../../../src/ui/screens/search.js";

describe("groupSearchHits", () => {
  it("groups hits by tipo across all three types", () => {
    const hits = [
      { tipo: "prenda", id: "p1", titulo: "Camisa", subtitulo: "Zara" },
      { tipo: "outfit", id: "o1", titulo: "Casual", subtitulo: "" },
      { tipo: "tip", id: "t1", titulo: "Combina colores", subtitulo: "" },
    ];

    const groups = groupSearchHits(hits);

    expect(groups.prenda).toEqual([hits[0]]);
    expect(groups.outfit).toEqual([hits[1]]);
    expect(groups.tip).toEqual([hits[2]]);
  });

  it("returns empty groups (not an error) when there are no hits", () => {
    const groups = groupSearchHits([]);

    expect(groups).toEqual({ prenda: [], outfit: [], tip: [] });
  });

  it("a match in only one type leaves the other groups empty", () => {
    const hits = [{ tipo: "tip", id: "t1", titulo: "Combina colores", subtitulo: "" }];

    const groups = groupSearchHits(hits);

    expect(groups.prenda).toEqual([]);
    expect(groups.outfit).toEqual([]);
    expect(groups.tip).toEqual(hits);
  });

  it("groups multiple hits of the same tipo together, in original order", () => {
    const hits = [
      { tipo: "prenda", id: "p1", titulo: "Camisa", subtitulo: "" },
      { tipo: "prenda", id: "p2", titulo: "Pantalon", subtitulo: "" },
    ];

    const groups = groupSearchHits(hits);

    expect(groups.prenda).toEqual(hits);
  });
});
