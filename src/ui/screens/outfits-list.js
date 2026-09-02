import { toOutfitViewModel } from "../../domain/mappers.js";
import { joinList } from "../../domain/format.js";

// Renders the outfit list. outfitsRepo.list() reads outfit_v, so estado and
// nombre_sugerido already come from Postgres -- no client-side re-derivation
// here (design.md "Refetch after mutation instead of client-side
// re-derivation"). Not unit tested per design.md's Testing Strategy table
// (DOM screens are manual/E2E for this change), same convention as
// prendas-list.js.
export async function renderOutfitsList(container, { outfitsRepo, onSelect, onCreate }) {
  container.innerHTML = "";

  const outfits = await outfitsRepo.list();

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.textContent = "Nuevo outfit";
  createButton.addEventListener("click", () => onCreate?.());
  container.append(createButton);

  const list = document.createElement("ul");
  list.className = "outfits-list";

  if (outfits.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Aun no hay outfits.";
    list.append(empty);
  }

  for (const row of outfits) {
    const vm = toOutfitViewModel(row);
    const item = document.createElement("li");
    item.className = "outfit-card";

    const title = document.createElement("strong");
    title.textContent = vm.titulo || vm.nombreSugerido || "Outfit sin nombre";

    const meta = document.createElement("span");
    meta.textContent = `${vm.estado} - ${joinList(vm.temporada)}`;

    item.append(title, meta);
    item.addEventListener("click", () => onSelect?.(row.id));
    list.append(item);
  }

  container.append(list);
  return list;
}
