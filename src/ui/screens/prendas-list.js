import { toPrendaViewModel } from "../../domain/mappers.js";
import { formatCurrency, joinList } from "../../domain/format.js";

// Renders the garment list into `container`. No client-side filtering or
// re-derivation here -- filters go through prendasRepo.list() and
// disponible/estado come from Postgres (design.md "Refetch after mutation
// instead of client-side re-derivation"). Not unit tested per design.md's
// Testing Strategy table (DOM screens are manual/E2E for this change).
export async function renderPrendasList(container, { prendasRepo, catalogosRepo, filters, onSelect, onCreate }) {
  container.innerHTML = "";

  const [prendas, colores] = await Promise.all([
    prendasRepo.list(filters),
    catalogosRepo.listColores(),
  ]);

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.textContent = "Nueva prenda";
  createButton.addEventListener("click", () => onCreate?.());
  container.append(createButton);

  const list = document.createElement("ul");
  list.className = "prendas-list";

  if (prendas.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Aun no hay prendas en el closet.";
    list.append(empty);
  }

  for (const row of prendas) {
    const vm = toPrendaViewModel(row, { coloresCatalog: colores });
    const item = document.createElement("li");
    item.className = "prenda-card";

    const title = document.createElement("strong");
    title.textContent = vm.nombre;

    const meta = document.createElement("span");
    meta.textContent = `${vm.tipoPrenda ?? ""} - ${joinList(vm.colores.map((c) => c.nombre))} - ${formatCurrency(vm.precio)}`;

    item.append(title, meta);
    item.addEventListener("click", () => onSelect?.(row.id));
    list.append(item);
  }

  container.append(list);
  return list;
}
