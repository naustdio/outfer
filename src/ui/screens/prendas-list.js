import { toPrendaViewModel } from "../../domain/mappers.js";
import { formatCurrency, joinList } from "../../domain/format.js";
import { icons } from "../icons.js";

// Renders the garment list into `container`. No client-side filtering or
// re-derivation here -- filters go through prendasRepo.list() and
// disponible/estado come from Postgres (design.md "Refetch after mutation
// instead of client-side re-derivation"). Not unit tested per design.md's
// Testing Strategy table (DOM screens are manual/E2E for this change).
export async function renderPrendasList(
  container,
  { prendasRepo, catalogosRepo, storageRepo, filters, onSelect, onCreate },
) {
  container.innerHTML = "";

  const [prendas, colores] = await Promise.all([
    prendasRepo.list(filters),
    catalogosRepo.listColores(),
  ]);

  const screen = document.createElement("div");
  screen.className = "screen prendas-list-screen";

  const header = document.createElement("div");
  header.className = "screen-header";
  const heading = document.createElement("h1");
  heading.textContent = "Prendas";
  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "btn btn-primary";
  createButton.textContent = "Agregar prenda";
  createButton.addEventListener("click", () => onCreate?.());
  header.append(heading, createButton);
  screen.append(header);

  const list = document.createElement("ul");
  list.className = "prendas-list card-list";

  if (prendas.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Aun no hay prendas en el closet.";
    list.append(empty);
  }

  for (const row of prendas) {
    const vm = toPrendaViewModel(row, { coloresCatalog: colores });
    const item = document.createElement("li");
    item.className = "prenda-card card card--row";

    // Thumbnail: first photo in fotos[], or a rounded icon placeholder --
    // a garment with zero photos is the common case at first (this task's
    // brief) and must never break the card layout. The bucket is private
    // (src/data/storage.js), so a fresh signed URL is fetched per card on
    // every render rather than cached/stored.
    const firstFoto = row.fotos?.[0];
    let avatar = makeIconAvatar();
    if (firstFoto && storageRepo) {
      const thumb = document.createElement("div");
      thumb.className = "prenda-thumb card-row-thumb";
      const img = document.createElement("img");
      img.alt = vm.nombre;
      thumb.append(img);
      avatar = thumb;
      storageRepo
        .getPrendaFotoUrl(firstFoto)
        .then((url) => {
          img.src = url;
        })
        .catch(() => avatar.replaceWith(makeIconAvatar()));
    }
    item.append(avatar);

    const body = document.createElement("div");
    body.className = "card-row-body";

    const title = document.createElement("strong");
    title.className = "card-title";
    title.textContent = vm.nombre;

    const meta = document.createElement("span");
    meta.className = "card-row-meta";
    meta.innerHTML = `${icons.tag}<span>${vm.tipoPrenda ?? "Prenda"} · ${joinList(vm.colores.map((c) => c.nombre))}</span>`;

    body.append(title, meta);

    const badge = document.createElement("span");
    badge.className = row.favorito ? "card-badge card-badge--favorito" : "card-badge";
    badge.innerHTML = `${row.favorito ? icons.star : ""}<span>${formatCurrency(vm.precio)}</span>`;

    item.append(body, badge);
    item.addEventListener("click", () => onSelect?.(row.id));
    list.append(item);
  }

  screen.append(list);
  container.append(screen);
  return list;
}

function makeIconAvatar() {
  const box = document.createElement("div");
  box.className = "card-row-icon";
  box.innerHTML = icons.tag;
  return box;
}
