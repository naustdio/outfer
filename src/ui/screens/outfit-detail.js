import { toOutfitViewModel, toPrendaViewModel } from "../../domain/mappers.js";
import { joinList } from "../../domain/format.js";

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
// be directly writable"), its non-derived fields, and the garment-linking
// UI (list of linked garments with a remove button, plus a select+add
// control for garments not yet linked). Not unit tested itself per
// design.md's Testing Strategy table (DOM screens are manual/E2E for this
// change; see prendas-list.js/prenda-detail.js/login.js headers) -- the
// testable logic lives in handleLinkGarment/handleUnlinkGarment above.
export async function renderOutfitDetail(
  container,
  id,
  { outfitsRepo, prendasRepo, linksRepo, catalogosRepo, onEdit, onDelete },
) {
  async function load() {
    const [{ outfit, prendaIds }, allPrendas, colores] = await Promise.all([
      outfitsRepo.getWithPrendas(id),
      prendasRepo.list(),
      catalogosRepo.listColores(),
    ]);
    return { outfit, prendaIds, allPrendas, colores };
  }

  async function draw({ outfit, prendaIds, allPrendas, colores }) {
    container.innerHTML = "";

    const vm = toOutfitViewModel(outfit);

    const title = document.createElement("h2");
    title.textContent = vm.titulo;

    const fields = document.createElement("dl");
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

    const linkedList = document.createElement("ul");
    linkedList.className = "outfit-linked-prendas";
    if (linkedPrendas.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Sin prendas vinculadas.";
      linkedList.append(empty);
    }
    for (const row of linkedPrendas) {
      const prendaVm = toPrendaViewModel(row, { coloresCatalog: colores });
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = prendaVm.nombre;
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Quitar";
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        const refetched = await handleUnlinkGarment({
          outfitsRepo,
          linksRepo,
          outfitId: id,
          prendaId: row.id,
        });
        await draw({ ...refetched, allPrendas, colores });
      });
      item.append(label, removeButton);
      linkedList.append(item);
    }

    const addForm = document.createElement("form");
    addForm.className = "outfit-add-prenda";
    const addSelect = document.createElement("select");
    addSelect.name = "prenda_id";
    for (const row of unlinkedPrendas) {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.nombre;
      addSelect.append(option);
    }
    const addButton = document.createElement("button");
    addButton.type = "submit";
    addButton.textContent = "Agregar prenda";
    addButton.disabled = unlinkedPrendas.length === 0;
    addForm.append(addSelect, addButton);
    addForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const prendaId = addSelect.value;
      if (!prendaId) return;
      addButton.disabled = true;
      const refetched = await handleLinkGarment({ outfitsRepo, linksRepo, outfitId: id, prendaId });
      await draw({ ...refetched, allPrendas, colores });
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => onEdit?.(vm.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", async () => {
      // FKs on outfit_prenda/outfit_tip cascade on delete (0003_joins.sql),
      // satisfying outfit-composition's "Delete an outfit" scenario without
      // manually unlinking first.
      await outfitsRepo.remove(vm.id);
      onDelete?.(vm.id);
    });

    container.append(title, fields, linkedList, addForm, editButton, deleteButton);
  }

  const state = await load();
  await draw(state);
  return container;
}
