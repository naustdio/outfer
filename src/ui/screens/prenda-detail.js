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
  { prendasRepo, catalogosRepo, outfitsRepo, tipsRepo, storageRepo, onEdit, onDelete, onSelectOutfit, onSelectTip },
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

  // Bucket is private (src/data/storage.js), so a fresh signed URL is
  // fetched on every render rather than cached -- correctness over
  // premature optimization (a cached URL could expire mid-view).
  const fotos = prenda.fotos ?? [];
  const fotoUrls = storageRepo
    ? await Promise.all(fotos.map((path) => storageRepo.getPrendaFotoUrl(path).catch(() => null)))
    : [];

  const screen = document.createElement("div");
  screen.className = "screen prenda-detail-screen";

  const header = document.createElement("div");
  header.className = "screen-header";

  const title = document.createElement("h1");
  title.textContent = vm.nombre;
  header.append(title);

  // Simple "main photo + thumbnail strip" gallery -- no lightbox, matching
  // this task's brief not to over-engineer this. Empty state matches the
  // reverse-lookup sections' renderEmptyState() below.
  const gallerySection = document.createElement("section");
  gallerySection.className = "foto-gallery";
  const validFotoUrls = fotoUrls.filter(Boolean);
  if (validFotoUrls.length === 0) {
    gallerySection.append(renderEmptyState("Sin fotos."));
  } else {
    const mainImg = document.createElement("img");
    mainImg.className = "foto-gallery-main";
    mainImg.alt = vm.nombre;
    mainImg.src = validFotoUrls[0];
    gallerySection.append(mainImg);

    if (validFotoUrls.length > 1) {
      const strip = document.createElement("div");
      strip.className = "foto-gallery-strip";
      for (const url of validFotoUrls) {
        const thumb = document.createElement("img");
        thumb.className = "foto-gallery-thumb";
        thumb.alt = vm.nombre;
        thumb.src = url;
        thumb.addEventListener("click", () => {
          mainImg.src = url;
        });
        strip.append(thumb);
      }
      gallerySection.append(strip);
    }
  }

  const fields = document.createElement("dl");
  fields.className = "detail-fields";
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
  editButton.className = "btn";
  editButton.textContent = "Editar prenda";
  editButton.addEventListener("click", () => onEdit?.(vm.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-danger";
  deleteButton.textContent = "Eliminar prenda";
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

  // Editorial "how to style this" module -- a small grid of outfit tiles,
  // not a plain list (design direction: signature detail for this screen).
  // Heading text and DOM order (h3 immediately followed by the list) are
  // pinned by tests/unit/ui/prenda-detail.test.js -- only classNames/styling
  // change here, no restructuring.
  const outfitsSection = document.createElement("section");
  outfitsSection.className = "style-module";
  const outfitsHeading = document.createElement("h3");
  outfitsHeading.className = "style-module-heading";
  outfitsHeading.textContent = "Outfits vinculados";
  outfitsSection.append(outfitsHeading);

  const outfitsList = document.createElement("ul");
  outfitsList.className = "style-module-grid";
  if (linkedOutfits.length === 0) {
    outfitsList.append(renderEmptyState("Sin outfits vinculados."));
  }
  for (const row of linkedOutfits) {
    const outfitVm = toOutfitViewModel(row);
    const item = document.createElement("li");
    item.className = "style-module-tile";
    item.addEventListener("click", () => onSelectOutfit?.(row.id));

    const outfitName = outfitVm.titulo || outfitVm.nombreSugerido || "Outfit sin nombre";

    // Same "let the photo carry the tile" idea as outfit-detail.js's
    // flatlay cards -- imagen_inspiracion is either a raw http(s) URL or an
    // internal Storage path (see outfit-form.js's upload flow), only the
    // latter needs signing. When there's an image, it's the whole tile (no
    // name label -- the photo grid IS the "how to style this" module); the
    // name only shows as a fallback for outfits with no image, so the tile
    // is never blank.
    if (row.imagen_inspiracion) {
      item.title = outfitName;
      const thumb = document.createElement("div");
      thumb.className = "style-module-thumb";
      const img = document.createElement("img");
      img.alt = outfitName;
      thumb.append(img);
      if (/^https?:\/\//i.test(row.imagen_inspiracion)) {
        img.src = row.imagen_inspiracion;
      } else if (storageRepo) {
        storageRepo
          .getPrendaFotoUrl(row.imagen_inspiracion)
          .then((url) => {
            img.src = url;
          })
          .catch(() => thumb.remove());
      }
      item.append(thumb);
    } else {
      const label = document.createElement("span");
      label.className = "style-module-tile-label";
      label.textContent = outfitName;
      item.append(label);
    }

    outfitsList.append(item);
  }
  outfitsSection.append(outfitsList);

  const linkedTipIds = new Set(linkedTipRows.map((row) => row.tip_id));
  const linkedTips = allTips.filter((t) => linkedTipIds.has(t.id));

  const tipsSection = document.createElement("section");
  tipsSection.className = "style-module";
  const tipsHeading = document.createElement("h3");
  tipsHeading.className = "style-module-heading";
  tipsHeading.textContent = "Tips vinculados";
  tipsSection.append(tipsHeading);

  const tipsList = document.createElement("ul");
  tipsList.className = "attach-list";
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

  header.append((() => {
    const actions = document.createElement("div");
    actions.className = "screen-actions";
    actions.append(editButton, deleteButton);
    return actions;
  })());

  screen.append(header, gallerySection, fields, outfitsSection, tipsSection);
  container.append(screen);
  return container;
}
