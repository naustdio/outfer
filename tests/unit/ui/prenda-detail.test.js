// @vitest-environment jsdom
//
// verify-report-pr5 CRITICAL-3 (carried over from verify-report-pr3.md /
// verify-report-pr4.md): garment-catalog "Garment detail shows linked
// outfits and tips" / "Garment with no links shows empty lists" were only
// ever manually verified in a browser -- no automated test file existed for
// prenda-detail.js's reverse-lookup sections. Same pattern PR2.5 established
// for tests/unit/ui/app.test.js: the REAL renderPrendaDetail (src/ui/screens
// /prenda-detail.js) wired against jsdom, with a fake/injectable
// Supabase-shaped repo object (list()/getById() returning plain arrays/
// objects), not a full browser and not mocking the render function itself.
import { describe, it, expect, vi } from "vitest";
import { renderPrendaDetail } from "../../../src/ui/screens/prenda-detail.js";

function fakePrenda(overrides = {}) {
  return {
    id: "p1",
    nombre: "Camisa azul",
    categoria: "Superior",
    tipo_prenda_id: "tp1",
    colores: ["Azul"],
    talla: "M",
    estado: "Bueno",
    disponible: true,
    cantidad: 1,
    precio: 100,
    fecha_ingreso: "2026-01-01",
    favorito: false,
    necesita_reparacion: false,
    tipo_dano: [],
    ...overrides,
  };
}

function fakeRepos({ prenda, linkedOutfitRows, linkedTipRows, allOutfits, allTips }) {
  return {
    prendasRepo: {
      getById: vi.fn().mockResolvedValue({ prenda, outfits: linkedOutfitRows, tips: linkedTipRows }),
    },
    catalogosRepo: {
      listColores: vi.fn().mockResolvedValue([{ valor: "Azul", nombre: "Azul", hex: "#0000ff" }]),
    },
    outfitsRepo: { list: vi.fn().mockResolvedValue(allOutfits) },
    tipsRepo: { list: vi.fn().mockResolvedValue(allTips) },
  };
}

describe("renderPrendaDetail: reverse-lookup sections (garment-catalog)", () => {
  it("shows only the outfits and tips actually linked to this garment, by name/text", async () => {
    const container = document.createElement("div");
    const repos = fakeRepos({
      prenda: fakePrenda(),
      linkedOutfitRows: [{ outfit_id: "o1" }],
      linkedTipRows: [{ tip_id: "t1" }],
      allOutfits: [
        { id: "o1", titulo: "Outfit playero" },
        { id: "o2", titulo: "Outfit no vinculado" },
      ],
      allTips: [
        { id: "t1", tip: "Combina bien con jeans" },
        { id: "t2", tip: "Tip no vinculado" },
      ],
    });

    await renderPrendaDetail(container, "p1", repos);

    const outfitsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Outfits vinculados");
    expect(outfitsHeading).not.toBeUndefined();
    const outfitsList = outfitsHeading.nextElementSibling;
    const outfitItems = [...outfitsList.querySelectorAll("li")];
    expect(outfitItems.map((li) => li.textContent)).toEqual(["Outfit playero"]);

    const tipsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Tips vinculados");
    expect(tipsHeading).not.toBeUndefined();
    const tipsList = tipsHeading.nextElementSibling;
    const tipItems = [...tipsList.querySelectorAll("li")];
    expect(tipItems.map((li) => li.textContent)).toEqual(["Combina bien con jeans"]);
  });

  it("shows empty-state lists when the garment has no linked outfits or tips", async () => {
    const container = document.createElement("div");
    const repos = fakeRepos({
      prenda: fakePrenda(),
      linkedOutfitRows: [],
      linkedTipRows: [],
      allOutfits: [{ id: "o1", titulo: "Outfit no vinculado" }],
      allTips: [{ id: "t1", tip: "Tip no vinculado" }],
    });

    await renderPrendaDetail(container, "p1", repos);

    const outfitsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Outfits vinculados");
    const outfitsEmpty = outfitsHeading.nextElementSibling.querySelector("li.empty-state");
    expect(outfitsEmpty).not.toBeNull();
    expect(outfitsEmpty.textContent).toBe("Sin outfits vinculados.");

    const tipsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Tips vinculados");
    const tipsEmpty = tipsHeading.nextElementSibling.querySelector("li.empty-state");
    expect(tipsEmpty).not.toBeNull();
    expect(tipsEmpty.textContent).toBe("Sin tips vinculados.");
  });

  it("clicking a linked outfit/tip item calls onSelectOutfit/onSelectTip with the right id", async () => {
    const container = document.createElement("div");
    const onSelectOutfit = vi.fn();
    const onSelectTip = vi.fn();
    const repos = fakeRepos({
      prenda: fakePrenda(),
      linkedOutfitRows: [{ outfit_id: "o1" }],
      linkedTipRows: [{ tip_id: "t1" }],
      allOutfits: [{ id: "o1", titulo: "Outfit playero" }],
      allTips: [{ id: "t1", tip: "Combina bien con jeans" }],
    });

    await renderPrendaDetail(container, "p1", { ...repos, onSelectOutfit, onSelectTip });

    container.querySelector("h3 + ul li").click();
    expect(onSelectOutfit).toHaveBeenCalledWith("o1");

    const tipsHeading = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Tips vinculados");
    tipsHeading.nextElementSibling.querySelector("li").click();
    expect(onSelectTip).toHaveBeenCalledWith("t1");
  });
});
