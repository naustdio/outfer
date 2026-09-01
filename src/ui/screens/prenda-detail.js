import { toPrendaViewModel } from "../../domain/mappers.js";
import { formatCurrency, formatDate, joinList } from "../../domain/format.js";

// Renders a single garment's detail (fields + edit/delete). Reverse-lookup
// sections (linked outfits/tips, garment-catalog spec "Reverse Lookups on
// Garment Detail") are Phase 10 in tasks.md, deliberately not built here --
// see openspec/changes/closet-app/tasks.md Phase 6 vs Phase 10 split. Not
// unit tested per design.md's Testing Strategy table (DOM screens are
// manual/E2E for this change).
export async function renderPrendaDetail(container, id, { prendasRepo, catalogosRepo, onEdit, onDelete }) {
  container.innerHTML = "";

  const [{ prenda }, colores] = await Promise.all([
    prendasRepo.getById(id),
    catalogosRepo.listColores(),
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

  container.append(title, fields, editButton, deleteButton);
  return container;
}
