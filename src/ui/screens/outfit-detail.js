import { toOutfitViewModel, toPrendaViewModel } from "../../domain/mappers.js";
import { joinList } from "../../domain/format.js";
import { renderEmptyState } from "../components/empty-state.js";
import { openPrendaPicker } from "../components/prenda-picker.js";
import { openTipPicker } from "../components/tip-picker.js";

// outfit-composition "Derived Outfit Status" / "Derived Suggested Name" +
// design.md "Refetch after mutation instead of client-side re-derivation":
// after a link/unlink write, the ONLY correct way to get the new
// estado/nombre_sugerido is to re-read outfit_v -- mirroring the rule in JS
// would reintroduce the dual-implementation drift the DB-derivation
// decision exists to eliminate. Extracted as plain functions (not inline in
// renderOutfitDetail) so that contract -- write, then refetch, never
// recompute -- is unit testable without a DOM/jsdom environment; see
// tests/unit/ui/outfit-link.test.js.
export async function handleLinkGarment({ outfitsRepo, linksRepo, outfitId, prendaId }) {
  await linksRepo.linkOutfitPrenda(outfitId, prendaId);
  return outfitsRepo.getWithPrendas(outfitId);
}

export async function handleUnlinkGarment({ outfitsRepo, linksRepo, outfitId, prendaId }) {
  await linksRepo.unlinkOutfitPrenda(outfitId, prendaId);
  return outfitsRepo.getWithPrendas(outfitId);
}

// styling-tips "Dual Attachment" is bidirectional, but the outfit side is
// now the primary entry point (tip-form.js's own attach section still works
// too -- same write-then-refetch contract as handleLinkGarment above, never
// a client-side splice of tipIds).
export async function handleAttachTip({ outfitsRepo, linksRepo, outfitId, tipId }) {
  await linksRepo.linkOutfitTip(outfitId, tipId);
  return outfitsRepo.getLinkedTipIds(outfitId);
}

export async function handleDetachTip({ outfitsRepo, linksRepo, outfitId, tipId }) {
  await linksRepo.unlinkOutfitTip(outfitId, tipId);
  return outfitsRepo.getLinkedTipIds(outfitId);
}

// Renders a single outfit's detail: derived fields (estado, nombreSugerido
// -- both read-only, never form inputs, per outfit-composition's "MUST NOT
// be directly writable"), its non-derived fields, the garment-linking UI
// (list of linked garments with a remove button, plus a select+add control
// for garments not yet linked), and a read-only linked-tips reverse-lookup
// section (styling-tips "Attach a tip to both an outfit and a garment" --
// "each entity's detail view MUST show the tip"; closes verify-report-pr3's
// WARNING-2/CRITICAL flag that this screen "renders no tip list at all").
// Attach/detach for tips stays on tip-form.js's dual-attachment UI, same
// division of responsibility as prenda-detail.js's linked-outfits/linked-
// tips sections (Phase 10). Not unit tested itself per design.md's Testing
// Strategy table (DOM screens are manual/E2E for this change; see
// prendas-list.js/prenda-detail.js/login.js headers) -- the testable logic
// lives in handleLinkGarment/handleUnlinkGarment above.
const EXTERNAL_URL_RE = /^https?:\/\//i;

export async function renderOutfitDetail(
  container,
  id,
  {
    outfitsRepo,
    prendasRepo,
    tipsRepo,
    linksRepo,
    catalogosRepo,
    storageRepo,
    onEdit,
    onDelete,
    onSelectPrenda,
    onSelectTip,
  },
) {
  async function load() {
    const [{ outfit, prendaIds }, tipIds, allPrendas, allTips, colores] = await Promise.all([
      outfitsRepo.getWithPrendas(id),
      outfitsRepo.getLinkedTipIds(id),
      prendasRepo.list(),
      tipsRepo.list(),
      catalogosRepo.listColores(),
    ]);
    return { outfit, prendaIds, tipIds, allPrendas, allTips, colores };
  }

  async function draw({ outfit, prendaIds, tipIds, allPrendas, allTips, colores }) {
    container.innerHTML = "";

    const vm = toOutfitViewModel(outfit);

    const screen = document.createElement("div");
    screen.className = "screen outfit-detail-screen";

    const header = document.createElement("div");
    header.className = "screen-header";

    const title = document.createElement("h1");
    title.textContent = vm.titulo || vm.nombreSugerido || "Outfit sin nombre";
    header.append(title);

    // imagen_inspiracion holds either a raw http(s) URL the user pasted, or
    // an internal Storage path (uploaded via drag/paste/file-picker in
    // outfit-form.js) -- only the latter needs a signed URL. Built here but
    // appended in the final screen.append() below, between header and
    // fields.
    let inspiracionImg = null;
    if (outfit.imagen_inspiracion) {
      inspiracionImg = document.createElement("img");
      inspiracionImg.className = "outfit-inspiracion-image";
      inspiracionImg.alt = "Imagen de inspiracion";
      if (EXTERNAL_URL_RE.test(outfit.imagen_inspiracion)) {
        inspiracionImg.src = outfit.imagen_inspiracion;
      } else if (storageRepo) {
        storageRepo
          .getPrendaFotoUrl(outfit.imagen_inspiracion)
          .then((url) => {
            inspiracionImg.src = url;
          })
          .catch(() => inspiracionImg.remove());
      }
    }

    const fields = document.createElement("dl");
    fields.className = "detail-fields";
    const rows = [
      ["Estado", vm.estado],
      ["Nombre sugerido", vm.nombreSugerido],
      ["Notas", vm.notas],
      ["Temporada", joinList(vm.temporada)],
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value ?? "—";
      fields.append(dt, dd);
    }

    const linkedSet = new Set(prendaIds);
    const linkedPrendas = allPrendas.filter((p) => linkedSet.has(p.id));
    const unlinkedPrendas = allPrendas.filter((p) => !linkedSet.has(p.id));

    // Flat-lay-style breakdown grid: the linked-garments section below the
    // main content, styled for the dark showcase palette (design direction:
    // signature detail for this screen).
    const flatlay = document.createElement("section");
    flatlay.className = "flatlay";
    const flatlayHeadingRow = document.createElement("div");
    flatlayHeadingRow.className = "flatlay-heading";
    const flatlayHeading = document.createElement("h3");
    flatlayHeading.textContent = "Prendas de este outfit";
    flatlayHeadingRow.append(flatlayHeading);
    flatlay.append(flatlayHeadingRow);

    const linkedList = document.createElement("ul");
    linkedList.className = "outfit-linked-prendas flatlay-grid";
    if (linkedPrendas.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Sin prendas vinculadas.";
      linkedList.append(empty);
    }
    for (const row of linkedPrendas) {
      const prendaVm = toPrendaViewModel(row, { coloresCatalog: colores });
      const item = document.createElement("li");
      item.className = "flatlay-item";

      const thumb = document.createElement("div");
      thumb.className = "flatlay-item-thumb";
      thumb.addEventListener("click", () => onSelectPrenda?.(row.id));
      const firstFoto = row.fotos?.[0];
      if (firstFoto && storageRepo) {
        const img = document.createElement("img");
        img.alt = prendaVm.nombre;
        thumb.append(img);
        storageRepo
          .getPrendaFotoUrl(firstFoto)
          .then((url) => {
            img.src = url;
          })
          .catch(() => thumb.classList.add("flatlay-item-thumb-empty"));
      } else {
        thumb.classList.add("flatlay-item-thumb-empty");
      }

      const label = document.createElement("span");
      label.className = "flatlay-item-label";
      label.textContent = prendaVm.nombre;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "flatlay-item-remove";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", `Quitar ${prendaVm.nombre}`);
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        const refetched = await handleUnlinkGarment({
          outfitsRepo,
          linksRepo,
          outfitId: id,
          prendaId: row.id,
        });
        await draw({ ...refetched, tipIds, allPrendas, allTips, colores });
      });

      item.append(thumb, removeButton, label);
      linkedList.append(item);
    }
    flatlay.append(linkedList);

    const addPrendaButton = document.createElement("button");
    addPrendaButton.type = "button";
    addPrendaButton.className = "btn flatlay-add";
    addPrendaButton.textContent = "+ Agregar prenda";
    addPrendaButton.disabled = unlinkedPrendas.length === 0;
    addPrendaButton.addEventListener("click", async () => {
      if (!prendasRepo || !catalogosRepo) return;
      addPrendaButton.disabled = true;
      try {
        const picked = await openPrendaPicker({
          prendasRepo,
          storageRepo,
          catalogosRepo,
          excludeIds: [...linkedSet],
        });
        if (!picked || picked.length === 0) return;
        let refetched;
        for (const row of picked) {
          refetched = await handleLinkGarment({ outfitsRepo, linksRepo, outfitId: id, prendaId: row.id });
        }
        await draw({ ...refetched, tipIds, allPrendas, allTips, colores });
      } finally {
        addPrendaButton.disabled = false;
      }
    });
    flatlay.append(addPrendaButton);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn";
    editButton.textContent = "Editar outfit";
    editButton.addEventListener("click", () => onEdit?.(vm.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger";
    deleteButton.textContent = "Eliminar outfit";
    deleteButton.addEventListener("click", async () => {
      // FKs on outfit_prenda/outfit_tip cascade on delete (0003_joins.sql),
      // satisfying outfit-composition's "Delete an outfit" scenario without
      // manually unlinking first.
      await outfitsRepo.remove(vm.id);
      onDelete?.(vm.id);
    });

    const actions = document.createElement("div");
    actions.className = "screen-actions";
    actions.append(editButton, deleteButton);
    header.append(actions);

    // Attach/detach lives here now (the outfit is the primary direction);
    // tip-form.js's own attach section still works too -- styling-tips
    // "Dual Attachment" stays bidirectional either way.
    const linkedTipSet = new Set(tipIds);
    const linkedTips = allTips.filter((t) => linkedTipSet.has(t.id));

    const tipsSection = document.createElement("section");
    tipsSection.className = "attach-section";
    const tipsHeading = document.createElement("h3");
    tipsHeading.textContent = "Tips vinculados";
    tipsSection.append(tipsHeading);

    const tipsList = document.createElement("ul");
    tipsList.className = "attach-list";
    if (linkedTips.length === 0) {
      tipsList.append(renderEmptyState("Sin tips vinculados."));
    }
    for (const row of linkedTips) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = row.tip;
      label.addEventListener("click", () => onSelectTip?.(row.id));
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost";
      removeButton.textContent = "Quitar";
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        const newTipIds = await handleDetachTip({ outfitsRepo, linksRepo, outfitId: id, tipId: row.id });
        await draw({ outfit, prendaIds, tipIds: newTipIds, allPrendas, allTips, colores });
      });
      item.append(label, removeButton);
      tipsList.append(item);
    }
    tipsSection.append(tipsList);

    const addTipButton = document.createElement("button");
    addTipButton.type = "button";
    addTipButton.className = "btn";
    addTipButton.textContent = "+ Agregar tip";
    addTipButton.addEventListener("click", async () => {
      addTipButton.disabled = true;
      try {
        const picked = await openTipPicker({ tipsRepo, excludeIds: [...linkedTipSet] });
        if (!picked || picked.length === 0) return;
        let newTipIds = tipIds;
        for (const row of picked) {
          newTipIds = await handleAttachTip({ outfitsRepo, linksRepo, outfitId: id, tipId: row.id });
        }
        await draw({ outfit, prendaIds, tipIds: newTipIds, allPrendas, allTips, colores });
      } finally {
        addTipButton.disabled = false;
      }
    });
    tipsSection.append(addTipButton);

    screen.append(header, ...(inspiracionImg ? [inspiracionImg] : []), fields, flatlay, tipsSection);
    container.append(screen);
  }

  const state = await load();
  await draw(state);
  return container;
}
