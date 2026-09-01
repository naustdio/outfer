// @vitest-environment jsdom
//
// jsdom is scoped to this file only via the pragma above (see
// vitest.config.js "unit" project, environment: "node" by default). Needed
// for the renderPrendaForm DOM-level tests below, which reproduce
// verify-report-pr2.md CRITICAL-1/CRITICAL-2 (silent data loss on edit,
// unsettable spec-required fields) -- a bug class the prior pure-function
// tests above could not catch because it lives entirely in which <input>s
// renderPrendaForm mounts.
import { describe, it, expect } from "vitest";
import {
  validatePrendaFormValues,
  sanitizePrendaFormValues,
  renderPrendaForm,
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

// verify-report-pr2.md CRITICAL-1: renderPrendaForm must mount an <input>/
// <select> for every spec-required garment-catalog "Garment Fields" field
// (categoria, tipo_prenda, colores, talla, fecha_ingreso, cantidad,
// temporada, favorito, estado), and editing one field must never silently
// wipe another field the garment already had a real value for.
describe("renderPrendaForm - edit does not destroy unrelated fields", () => {
  const existingPrenda = {
    id: "p1",
    nombre: "Camisa azul",
    categoria: "Superior",
    tipo_prenda_id: "tp1",
    colores: ["Azul"],
    talla: "M",
    fecha_ingreso: "2026-01-01",
    cantidad: 1,
    temporada: ["Verano"],
    favorito: true,
    estado: "En closet",
    necesita_reparacion: false,
    tipo_dano: [],
    detalle_dano: null,
  };

  function mountEditForm() {
    const container = document.createElement("div");
    let capturedPatch;
    const prendasRepo = {
      update: (id, patch) => {
        capturedPatch = patch;
        return Promise.resolve({ ...existingPrenda, ...patch });
      },
    };
    renderPrendaForm(container, {
      prenda: existingPrenda,
      coloresCatalog: [{ valor: "Azul", nombre: "Azul" }],
      tiposPrendaCatalog: [{ id: "tp1", nombre: "Camisa" }],
      prendasRepo,
    });
    return { container, getCapturedPatch: () => capturedPatch };
  }

  it("mounts inputs for every spec-required Garment Fields field", () => {
    const { container } = mountEditForm();
    expect(container.querySelector('[name="talla"]')).not.toBeNull();
    expect(container.querySelector('[name="favorito"]')).not.toBeNull();
    expect(container.querySelector('[name="estado"]')).not.toBeNull();
    expect(container.querySelectorAll('[name="temporada"]').length).toBeGreaterThan(0);
  });

  it("preserves talla, favorito, estado, and temporada when only nombre changes", async () => {
    const { container, getCapturedPatch } = mountEditForm();

    const nombreInput = container.querySelector('input[name="nombre"]');
    nombreInput.value = "Camisa azul editada";

    const form = container.querySelector("form");
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    const patch = getCapturedPatch();
    expect(patch.talla).toBe("M");
    expect(patch.favorito).toBe(true);
    expect(patch.estado).toBe("En closet");
    expect(patch.temporada).toEqual(["Verano"]);
  });
});
