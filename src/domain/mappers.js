// DB row -> view model. Derivation itself (estado, nombre_sugerido,
// disponible) lives in Postgres -- these mappers only reshape/resolve
// lookups for display, never recompute business rules (design.md
// "Refetch after mutation instead of client-side re-derivation").
export function toPrendaViewModel(row, { coloresCatalog = [], tiposPrendaCatalog = [] } = {}) {
  const colorByValor = new Map(coloresCatalog.map((c) => [c.valor, c]));
  const tipoById = new Map(tiposPrendaCatalog.map((t) => [t.id, t]));

  const colores = (row.colores ?? []).map((valor) => {
    const entry = colorByValor.get(valor);
    return { nombre: entry ? entry.nombre : valor, hex: entry ? entry.hex : null };
  });

  const tipo = tipoById.get(row.tipo_prenda_id);

  return {
    ...row,
    colores,
    tipoPrenda: tipo ? tipo.nombre : null,
  };
}

export function toOutfitViewModel(row) {
  const { nombre_sugerido, ...rest } = row;
  return { ...rest, nombreSugerido: nombre_sugerido };
}
