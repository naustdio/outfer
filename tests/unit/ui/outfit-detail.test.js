// @vitest-environment jsdom
//
// verify-report-pr5 CRITICAL-3 (carried over from verify-report-pr3.md,
// which originally flagged outfit-detail.js as rendering NO tip list at
// all; verify-report-pr4.md confirmed the section was later added, but it
// never had its own automated test). Same pattern PR2.5 established for
// tests/unit/ui/app.test.js: the REAL renderOutfitDetail (src/ui/screens/
// outfit-detail.js) wired against jsdom, with fake/injectable
// Supabase-shaped repos, not a full browser.
import { describe, it, expect, vi } from "vitest";
import { renderOutfitDetail } from "../../../src/ui/screens/outfit-detail.js";

function fakeOutfit(overrides = {}) {
  return {
    id: "o1",
    titulo: "Outfit playero",
    notas: "",
    temporada: [],
    estado: "Disponible",
    nombre_sugerido: "Camisa + short",
    ...overrides,
  };
}

function fakeRepos({ outfit, prendaIds, tipIds, allPrendas, allTips }) {
  return {
    outfitsRepo: {
      getWithPrendas: vi.fn().mockResolvedValue({ outfit, prendaIds }),
      getLinkedTipIds: vi.fn().mockResolvedValue(tipIds),
    },
    prendasRepo: { list: vi.fn().mockResolvedValue(allPrendas) },
    tipsRepo: { list: vi.fn().mockResolvedValue(allTips) },
    linksRepo: {
      linkOutfitPrenda: vi.fn(),
      unlinkOutfitPrenda: vi.fn(),
    },
    catalogosRepo: { listColores: vi.fn().mockResolvedValue([]) },
  };
}

describe("renderOutfitDetail: linked-tips reverse-lookup section (styling-tips)", () => {
  it("shows only the tips actually linked to this outfit, by text", async () => {
    const container = document.createElement("div");
    const repos = fakeRepos({
      outfit: fakeOutfit(),
      prendaIds: [],
      tipIds: ["t1"],
      allPrendas: [],
      allTips: [
        { id: "t1", tip: "Combina bien con jeans" },
        { id: "t2", tip: "Tip no vinculado" },
      ],
    });

    await renderOutfitDetail(container, "o1", repos);

    const tipsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Tips vinculados");
    expect(tipsHeading).not.toBeUndefined();
    const tipItems = [...tipsHeading.nextElementSibling.querySelectorAll("li")];
    expect(tipItems.map((li) => li.textContent)).toEqual(["Combina bien con jeans"]);
  });

  it("shows an empty-state list when the outfit has no linked tips", async () => {
    const container = document.createElement("div");
    const repos = fakeRepos({
      outfit: fakeOutfit(),
      prendaIds: [],
      tipIds: [],
      allPrendas: [],
      allTips: [{ id: "t1", tip: "Tip no vinculado" }],
    });

    await renderOutfitDetail(container, "o1", repos);

    const tipsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Tips vinculados");
    const tipsEmpty = tipsHeading.nextElementSibling.querySelector("li.empty-state");
    expect(tipsEmpty).not.toBeNull();
    expect(tipsEmpty.textContent).toBe("Sin tips vinculados.");
  });

  it("clicking a linked tip item calls onSelectTip with the right id", async () => {
    const container = document.createElement("div");
    const onSelectTip = vi.fn();
    const repos = fakeRepos({
      outfit: fakeOutfit(),
      prendaIds: [],
      tipIds: ["t1"],
      allPrendas: [],
      allTips: [{ id: "t1", tip: "Combina bien con jeans" }],
    });

    await renderOutfitDetail(container, "o1", { ...repos, onSelectTip });

    const tipsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Tips vinculados");
    tipsHeading.nextElementSibling.querySelector("li").click();
    expect(onSelectTip).toHaveBeenCalledWith("t1");
  });
});
