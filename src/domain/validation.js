// Pure functions only -- src/domain/ imports nothing (design.md). These
// rules mirror the DB constraints (0002_entities.sql) for fast client-side
// feedback; the database remains the source of truth / last line of defense.
export function validatePrenda(input) {
  const errors = {};

  if (!input.nombre || input.nombre.trim() === "") {
    errors.nombre = "El nombre es obligatorio.";
  }
  if (!input.fecha_ingreso) {
    errors.fecha_ingreso = "La fecha de ingreso es obligatoria.";
  }
  if (!input.tipo_prenda_id) {
    errors.tipo_prenda_id = "El tipo de prenda es obligatorio.";
  }
  if (!input.categoria) {
    errors.categoria = "La categoria es obligatoria.";
  }

  const colores = input.colores ?? [];
  if (colores.length < 1 || colores.length > 3) {
    errors.colores = "Selecciona entre 1 y 3 colores.";
  }

  if (input.cantidad !== undefined && input.cantidad !== null && input.cantidad <= 0) {
    errors.cantidad = "La cantidad debe ser mayor a 0.";
  }

  if (input.precio !== undefined && input.precio !== null && input.precio < 0) {
    errors.precio = "El precio no puede ser negativo.";
  }

  if (input.necesita_reparacion && (!input.tipo_dano || input.tipo_dano.length === 0)) {
    errors.tipo_dano = "Indica el tipo de dano si la prenda necesita reparacion.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
