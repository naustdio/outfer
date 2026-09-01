import { describe, it, expect } from "vitest";
import {
  validatePrendaFormValues,
  sanitizePrendaFormValues,
} from "../../../src/ui/screens/prenda-form.js";

const validValues = {
  nombre: "Camisa azul",
  categoria: "Superior",
  tipo_prenda_id: "tp1",
  colores: ["Azul"],
  fecha_ingreso: "2026-01-01",
  cantidad: 1,
  precio: 10,
  necesita_reparacion: false,
  tipo_dano: [],
  detalle_dano: null,
};

describe("validatePrendaFormValues", () => {
  it("rejects a 4th color", () => {
    const result = validatePrendaFormValues({
      ...validValues,
      colores: ["Azul", "Negro", "Blanco", "Rojo"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.colores).toBeDefined();
  });

  it("rejects necesita_reparacion=true with no tipo_dano selected", () => {
    const result = validatePrendaFormValues({
      ...validValues,
      necesita_reparacion: true,
      tipo_dano: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.tipo_dano).toBeDefined();
  });

  it("accepts necesita_reparacion=true with a tipo_dano selected", () => {
    const result = validatePrendaFormValues({
      ...validValues,
      necesita_reparacion: true,
      tipo_dano: ["Boton"],
    });
    expect(result.valid).toBe(true);
  });
});

describe("sanitizePrendaFormValues", () => {
  it("clears tipo_dano and detalle_dano when necesita_reparacion is turned off", () => {
    const dirty = {
      ...validValues,
      necesita_reparacion: false,
      tipo_dano: ["Mancha"],
      detalle_dano: "mancha en manga",
    };
    const clean = sanitizePrendaFormValues(dirty);
    expect(clean.tipo_dano).toEqual([]);
    expect(clean.detalle_dano).toBeNull();
  });

  it("leaves tipo_dano and detalle_dano untouched when necesita_reparacion is true", () => {
    const dirty = {
      ...validValues,
      necesita_reparacion: true,
      tipo_dano: ["Mancha"],
      detalle_dano: "mancha en manga",
    };
    const clean = sanitizePrendaFormValues(dirty);
    expect(clean.tipo_dano).toEqual(["Mancha"]);
    expect(clean.detalle_dano).toBe("mancha en manga");
  });
});
