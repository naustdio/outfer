import { describe, it, expect } from "vitest";
import { toPrendaViewModel, toOutfitViewModel } from "../../../src/domain/mappers.js";

describe("toPrendaViewModel", () => {
  const coloresCatalog = [
    { valor: "Azul", nombre: "Azul", hex: "#0000FF" },
    { valor: "Negro", nombre: "Negro", hex: "#000000" },
  ];
  const tiposPrendaCatalog = [{ id: "tp1", nombre: "Camisa", categoria: "Superior" }];

  it("resolves color[] to [{nombre, hex}] via the colores catalog", () => {
    const row = { id: "p1", colores: ["Azul", "Negro"], tipo_prenda_id: "tp1" };

    const vm = toPrendaViewModel(row, { coloresCatalog, tiposPrendaCatalog });

    expect(vm.colores).toEqual([
      { nombre: "Azul", hex: "#0000FF" },
      { nombre: "Negro", hex: "#000000" },
    ]);
  });

  it("flattens tipo_prenda_id to the tipo_prenda name", () => {
    const row = { id: "p1", colores: [], tipo_prenda_id: "tp1" };

    const vm = toPrendaViewModel(row, { coloresCatalog, tiposPrendaCatalog });

    expect(vm.tipoPrenda).toBe("Camisa");
  });

  it("keeps unknown color/tipo ids from crashing (falls back gracefully)", () => {
    const row = { id: "p1", colores: ["Multicolor"], tipo_prenda_id: "unknown" };

    const vm = toPrendaViewModel(row, { coloresCatalog, tiposPrendaCatalog });

    expect(vm.colores).toEqual([{ nombre: "Multicolor", hex: null }]);
    expect(vm.tipoPrenda).toBeNull();
  });
});

describe("toOutfitViewModel", () => {
  it("passes through DB-derived estado/nombre_sugerido without recomputing them", () => {
    const row = { id: "o1", titulo: "Casual", estado: "Disponible", nombre_sugerido: "Camisa + Jeans" };

    const vm = toOutfitViewModel(row);

    expect(vm).toEqual({ id: "o1", titulo: "Casual", estado: "Disponible", nombreSugerido: "Camisa + Jeans" });
  });
});
