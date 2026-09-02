import { toPrendaViewModel } from "../../domain/mappers.js";
import { formatCurrency, joinList } from "../../domain/format.js";

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
    item.className = "prenda-card card";

    // Thumbnail: first photo in fotos[], or a neutral empty-state block --
    // a garment with zero photos is the common case at first (this task's
    // brief) and must never break the card layout. The bucket is private
    // (src/data/storage.js), so a fresh signed URL is fetched per card on
    // every render rather than cached/stored.
    const thumb = document.createElement("div");
    thumb.className = "prenda-thumb";
    const firstFoto = row.fotos?.[0];
    if (firstFoto && storageRepo) {
      const img = document.createElement("img");
      img.alt = vm.nombre;
      thumb.append(img);
      storageRepo
        .getPrendaFotoUrl(firstFoto)
        .then((url) => {
          img.src = url;
        })
        .catch(() => thumb.classList.add("prenda-thumb-empty"));
    } else {
      thumb.classList.add("prenda-thumb-empty");
    }
    item.append(thumb);

    const title = document.createElement("strong");
    title.className = "card-title";
    title.textContent = vm.nombre;

    const meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent = `${vm.tipoPrenda ?? ""} · ${joinList(vm.colores.map((c) => c.nombre))} · ${formatCurrency(vm.precio)}`;

    item.append(title, meta);
    item.addEventListener("click", () => onSelect?.(row.id));
    list.append(item);
  }

  screen.append(list);
  container.append(screen);
  return list;
}
