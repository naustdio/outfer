import { toPrendaViewModel, toOutfitViewModel } from "../../domain/mappers.js";
import { formatCurrency, formatDate, joinList } from "../../domain/format.js";
import { renderEmptyState } from "../components/empty-state.js";

// Renders a single garment's detail (fields + edit/delete + reverse-lookup
// sections). garment-catalog "Reverse Lookups on Garment Detail": "A
// garment's detail view MUST list every outfit that currently links to it
// and every tip attached to it." `prendasRepo.getById(id)` already returns
// `{ prenda, outfits: [{outfit_id}], tips: [{tip_id}] }` (design.md
// Interfaces/Contracts, built in PR2 -- see tests/unit/data/prendas.test.js)
// specifically so Phase 10 didn't need a new data-layer method; this screen
// resolves those ids to full outfit/tip rows via outfitsRepo.list() /
// tipsRepo.list(), the same "fetch the full catalog, filter by linked ids"
// pattern outfit-detail.js already uses for its garment-linking UI. Not
// unit tested per design.md's Testing Strategy table (DOM screens are
// manual/E2E for this change).
export async function renderPrendaDetail(
  container,
  id,
  { prendasRepo, catalogosRepo, outfitsRepo, tipsRepo, onEdit, onDelete, onSelectOutfit, onSelectTip },
) {
  container.innerHTML = "";

  const [{ prenda, outfits: linkedOutfitRows, tips: linkedTipRows }, colores, allOutfits, allTips] =
    await Promise.all([
      prendasRepo.getById(id),
      catalogosRepo.listColores(),
      outfitsRepo.list(),
      tipsRepo.list(),
    ]);
  const vm = toPrendaViewModel(prenda, { coloresCatalog: colores });

  const title = document.createElement("h2");
  title.textContent = vm.nombre;

  const fields = document.createElement("dl");
  const rows = [
    ["Tipo", vm.tipoPrenda],
    ["Colores", joinList(vm.colores.map((c) => c.nombre))],
    ["Talla", vm.talla],
    ["Estado", vm.estado],
    ["Disponible", vm.disponible ? "Si" : "No"],
    ["Cantidad", vm.cantidad],
    ["Precio", formatCurrency(vm.precio)],
    ["Ingreso", formatDate(vm.fecha_ingreso)],
    ["Favorito", vm.favorito ? "Si" : "No"],
    [
      "Reparacion",
      vm.necesita_reparacion ? joinList(vm.tipo_dano) : "No requiere",
    ],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value ?? "—";
    fields.append(dt, dd);
  }

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "Editar";
  editButton.addEventListener("click", () => onEdit?.(vm.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Eliminar";
  deleteButton.addEventListener("click", async () => {
    // FKs on the join tables cascade on delete (0003_joins.sql), so this
    // also removes any outfit_prenda/prenda_tip links -- satisfies
    // garment-catalog's "Delete a garment" scenario without extra UI work.
    await prendasRepo.remove(vm.id);
    onDelete?.(vm.id);
  });

  // Reverse-lookup sections: read-only, no attach/detach controls here --
  // linking/detaching already lives on the outfit side (outfit-detail.js's
  // garment-add form) and the tip side (tip-form.js's dual-attachment
  // sections), matching garment-catalog's requirement wording ("MUST list",
  // not "MUST manage").
  const linkedOutfitIds = new Set(linkedOutfitRows.map((row) => row.outfit_id));
  const linkedOutfits = allOutfits.filter((o) => linkedOutfitIds.has(o.id));

  const outfitsSection = document.createElement("section");
  const outfitsHeading = document.createElement("h3");
  outfitsHeading.textContent = "Outfits vinculados";
  outfitsSection.append(outfitsHeading);

  const outfitsList = document.createElement("ul");
  if (linkedOutfits.length === 0) {
    outfitsList.append(renderEmptyState("Sin outfits vinculados."));
  }
  for (const row of linkedOutfits) {
    const outfitVm = toOutfitViewModel(row);
    const item = document.createElement("li");
    item.textContent = outfitVm.titulo || outfitVm.nombreSugerido || "Outfit sin nombre";
    item.addEventListener("click", () => onSelectOutfit?.(row.id));
    outfitsList.append(item);
  }
  outfitsSection.append(outfitsList);

  const linkedTipIds = new Set(linkedTipRows.map((row) => row.tip_id));
  const linkedTips = allTips.filter((t) => linkedTipIds.has(t.id));

  const tipsSection = document.createElement("section");
  const tipsHeading = document.createElement("h3");
  tipsHeading.textContent = "Tips vinculados";
  tipsSection.append(tipsHeading);

  const tipsList = document.createElement("ul");
  if (linkedTips.length === 0) {
    tipsList.append(renderEmptyState("Sin tips vinculados."));
  }
  for (const row of linkedTips) {
    const item = document.createElement("li");
    item.textContent = row.tip;
    item.addEventListener("click", () => onSelectTip?.(row.id));
    tipsList.append(item);
  }
  tipsSection.append(tipsList);

  container.append(title, fields, outfitsSection, tipsSection, editButton, deleteButton);
  return container;
}
