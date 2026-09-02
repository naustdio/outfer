import { describe, it, expect } from "vitest";
import { validatePrenda } from "../../../src/domain/validation.js";

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
