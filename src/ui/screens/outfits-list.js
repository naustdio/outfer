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

  const screen = document.createElement("div");
  screen.className = "screen outfits-list-screen";

  const header = document.createElement("div");
  header.className = "screen-header";
  const heading = document.createElement("h1");
  heading.textContent = "Outfits";
  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "btn btn-primary";
  createButton.textContent = "Armar outfit";
  createButton.addEventListener("click", () => onCreate?.());
  header.append(heading, createButton);
  screen.append(header);

  const list = document.createElement("ul");
  list.className = "outfits-list card-list";

  if (outfits.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Aun no hay outfits.";
    list.append(empty);
  }

  for (const row of outfits) {
    const vm = toOutfitViewModel(row);
    const item = document.createElement("li");
    item.className = "outfit-card card";

    const title = document.createElement("strong");
    title.className = "card-title";
    title.textContent = vm.titulo || vm.nombreSugerido || "Outfit sin nombre";

    const meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent = `${vm.estado} · ${joinList(vm.temporada)}`;

    item.append(title, meta);
    item.addEventListener("click", () => onSelect?.(row.id));
    list.append(item);
  }

  screen.append(list);
  container.append(screen);
  return list;
}
