import { validatePrenda } from "../../domain/validation.js";

// Clears damage detail when the flag is off -- garment-catalog spec
// "Clearing damage flag clears damage detail": tipo_dano/detalle_dano must
// no longer be treated as active damage data once necesita_reparacion is
// false, so the form's own save path enforces that rather than just hiding
// the fields in the UI.
export function sanitizePrendaFormValues(values) {
  if (!values.necesita_reparacion) {
    return { ...values, tipo_dano: [], detalle_dano: null };
  }
  return values;
}

// Single entry point the form's submit handler uses: sanitize first, then
// delegate the actual rules to domain/validation.js (mirrors DB
// constraints -- design.md "What is left client-side").
export function validatePrendaFormValues(values) {
  return validatePrenda(sanitizePrendaFormValues(values));
}

// Reads a submitted <form> into the plain-object shape
// validatePrendaFormValues()/the repos expect. Not unit tested directly
// (DOM-only glue, no branching) -- covered indirectly once the form is
// exercised manually per design.md's Testing Strategy table.
export function readPrendaFormValues(form) {
  const data = new FormData(form);
  return {
    nombre: data.get("nombre") ?? "",
    categoria: data.get("categoria") || null,
    tipo_prenda_id: data.get("tipo_prenda_id") || null,
    colores: data.getAll("colores"),
    talla: data.get("talla") || null,
    fecha_ingreso: data.get("fecha_ingreso") || null,
    cantidad: data.get("cantidad") ? Number(data.get("cantidad")) : undefined,
    precio: data.get("precio") ? Number(data.get("precio")) : undefined,
    favorito: data.get("favorito") === "on",
    necesita_reparacion: data.get("necesita_reparacion") === "on",
    tipo_dano: data.getAll("tipo_dano"),
    detalle_dano: data.get("detalle_dano") || null,
  };
}
