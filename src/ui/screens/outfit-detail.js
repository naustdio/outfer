import { toOutfitViewModel, toPrendaViewModel } from "../../domain/mappers.js";
import { joinList } from "../../domain/format.js";
import { renderEmptyState } from "../components/empty-state.js";

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
export async function renderOutfitDetail(
  container,
  id,
  { outfitsRepo, prendasRepo, tipsRepo, linksRepo, catalogosRepo, onEdit, onDelete, onSelectTip },
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
      const label = document.createElement("span");
      label.textContent = prendaVm.nombre;
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost";
      removeButton.textContent = "Quitar";
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
      item.append(label, removeButton);
      linkedList.append(item);
    }
    flatlay.append(linkedList);

    const addForm = document.createElement("form");
    addForm.className = "outfit-add-prenda flatlay-add";
    const addSelect = document.createElement("select");
    addSelect.name = "prenda_id";
    addSelect.setAttribute("aria-label", "Prenda a agregar");
    for (const row of unlinkedPrendas) {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.nombre;
      addSelect.append(option);
    }
    const addButton = document.createElement("button");
    addButton.type = "submit";
    addButton.className = "btn";
    addButton.textContent = "Agregar prenda";
    addButton.disabled = unlinkedPrendas.length === 0;
    addForm.append(addSelect, addButton);
    addForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const prendaId = addSelect.value;
      if (!prendaId) return;
      addButton.disabled = true;
      const refetched = await handleLinkGarment({ outfitsRepo, linksRepo, outfitId: id, prendaId });
      await draw({ ...refetched, tipIds, allPrendas, allTips, colores });
    });
    flatlay.append(addForm);

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

    // Read-only reverse lookup -- attach/detach for tips lives on
    // tip-form.js's dual-attachment UI (styling-tips), not here.
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
      item.textContent = row.tip;
      item.addEventListener("click", () => onSelectTip?.(row.id));
      tipsList.append(item);
    }
    tipsSection.append(tipsList);

    screen.append(header, fields, flatlay, tipsSection);
    container.append(screen);
  }

  const state = await load();
  await draw(state);
  return container;
}
