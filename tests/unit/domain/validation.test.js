import { describe, it, expect } from "vitest";
import { validatePrenda, validateOutfit, validateTip } from "../../../src/domain/validation.js";

const validPrenda = {
  nombre: "Camisa azul",
  categoria: "Superior",
  tipo_prenda_id: "tp1",
  colores: ["Azul"],
  fecha_ingreso: "2026-01-01",
  cantidad: 1,
  precio: 10,
  necesita_reparacion: false,
};

describe("validatePrenda", () => {
  it("accepts a minimal valid prenda", () => {
    expect(validatePrenda(validPrenda)).toEqual({ valid: true, errors: {} });
  });

  it("requires nombre", () => {
    const result = validatePrenda({ ...validPrenda, nombre: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.nombre).toBeDefined();
  });

  it("requires fecha_ingreso", () => {
    const result = validatePrenda({ ...validPrenda, fecha_ingreso: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.fecha_ingreso).toBeDefined();
  });

  it("rejects 0 colores", () => {
    const result = validatePrenda({ ...validPrenda, colores: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.colores).toBeDefined();
  });

  it("rejects a 4th color", () => {
    const result = validatePrenda({ ...validPrenda, colores: ["Azul", "Negro", "Blanco", "Rojo"] });
    expect(result.valid).toBe(false);
    expect(result.errors.colores).toBeDefined();
  });

  it("accepts exactly 3 colores", () => {
    const result = validatePrenda({ ...validPrenda, colores: ["Azul", "Negro", "Blanco"] });
    expect(result.valid).toBe(true);
  });

  it("rejects cantidad <= 0", () => {
    const result = validatePrenda({ ...validPrenda, cantidad: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.cantidad).toBeDefined();
  });

  it("rejects negative precio", () => {
    const result = validatePrenda({ ...validPrenda, precio: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.precio).toBeDefined();
  });

  it("allows a missing/null precio (optional field)", () => {
    const result = validatePrenda({ ...validPrenda, precio: null });
    expect(result.valid).toBe(true);
  });

  it("requires tipo_dano when necesita_reparacion is true", () => {
    const result = validatePrenda({ ...validPrenda, necesita_reparacion: true, tipo_dano: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.tipo_dano).toBeDefined();
  });

  it("accepts necesita_reparacion=true with a non-empty tipo_dano", () => {
    const result = validatePrenda({
      ...validPrenda,
      necesita_reparacion: true,
      tipo_dano: ["Boton"],
    });
    expect(result.valid).toBe(true);
  });
});

// outfit-composition "Outfit Fields": titulo is the only DB-required
// (not null) writable field on `outfit` (0002_entities.sql) -- estado and
// nombre_sugerido are derived and never validated as form input here.
describe("validateOutfit", () => {
  it("accepts a minimal valid outfit", () => {
    expect(validateOutfit({ titulo: "Casual viernes" })).toEqual({ valid: true, errors: {} });
  });

  it("requires titulo", () => {
    const result = validateOutfit({ titulo: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.titulo).toBeDefined();
  });

  it("accepts optional imagen_inspiracion, notas, and temporada", () => {
    const result = validateOutfit({
      titulo: "Casual viernes",
      imagen_inspiracion: "https://example.com/img.jpg",
      notas: "Para la oficina",
      temporada: ["Verano", "Otono"],
    });
    expect(result.valid).toBe(true);
  });
});

// styling-tips "Tip Fields and CRUD": "A tip MUST record at least a text
// body" -- `tip` is the only not-null writable column (0002_entities.sql).
describe("validateTip", () => {
  it("accepts a minimal valid tip", () => {
    expect(validateTip({ tip: "Combina colores neutros" })).toEqual({ valid: true, errors: {} });
  });

  it("requires tip text", () => {
    const result = validateTip({ tip: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.tip).toBeDefined();
  });

  it("accepts optional descripcion and categoria", () => {
    const result = validateTip({
      tip: "Combina colores neutros",
      descripcion: "Funciona con la mayoria de prendas",
      categoria: ["Colores", "Ocasion"],
    });
    expect(result.valid).toBe(true);
  });
});
