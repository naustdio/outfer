import { toPrendaViewModel } from "../../domain/mappers.js";

// Modal garment picker: search + group-by-tipo + thumbnail grid, multi-select.
// Used by outfit-form.js to attach garments while composing a new outfit
// (outfit_prenda needs a real outfit id, so linking itself only happens on
// submit -- this just collects the id set). A native <dialog> keeps focus
// trapping/backdrop/Escape-to-close for free instead of hand-rolling them.
//
// Returns a Promise that resolves with the array of newly selected prenda
// rows on confirm, or null if the user cancels/closes without confirming.
export function openPrendaPicker({ prendasRepo, storageRepo, catalogosRepo, excludeIds = [] }) {
  return new Promise(async (resolve) => {
    const excluded = new Set(excludeIds);
    const selected = new Set();

    const dialog = document.createElement("dialog");
    dialog.className = "prenda-picker-dialog";

    const heading = document.createElement("h2");
    heading.textContent = "Agregar prendas";

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Buscar por nombre...";
    searchInput.className = "prenda-picker-search";

    const body = document.createElement("div");
    body.className = "prenda-picker-body";

    const footer = document.createElement("div");
    footer.className = "prenda-picker-footer";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "btn btn-primary";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn-ghost";
    cancelButton.textContent = "Cancelar";

    footer.append(confirmButton, cancelButton);
    dialog.append(heading, searchInput, body, footer);
    document.body.append(dialog);

    function updateConfirmLabel() {
      confirmButton.textContent = selected.size > 0 ? `Agregar (${selected.size})` : "Agregar";
      confirmButton.disabled = selected.size === 0;
    }
    updateConfirmLabel();

    function close(result) {
      dialog.close();
      dialog.remove();
      resolve(result);
    }

    cancelButton.addEventListener("click", () => close(null));
    dialog.addEventListener("cancel", () => close(null)); // Escape key
    confirmButton.addEventListener("click", () =>
      close(allPrendas.filter((p) => selected.has(p.id))),
    );

    let allPrendas = [];
    let tiposById = new Map();
    let colores = [];

    function renderGrid(filterText) {
      body.innerHTML = "";
      const needle = filterText.trim().toLowerCase();

      const candidates = allPrendas.filter((p) => !excluded.has(p.id));
      const filtered = needle
        ? candidates.filter((p) => p.nombre?.toLowerCase().includes(needle))
        : candidates;

      if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "prenda-picker-empty";
        empty.textContent = "No hay prendas que coincidan.";
        body.append(empty);
        return;
      }

      const groups = new Map(); // tipoNombre -> rows[]
      for (const row of filtered) {
        const tipoNombre = tiposById.get(row.tipo_prenda_id) ?? "Sin tipo";
        if (!groups.has(tipoNombre)) groups.set(tipoNombre, []);
        groups.get(tipoNombre).push(row);
      }

      for (const [tipoNombre, rows] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const groupEl = document.createElement("section");
        groupEl.className = "prenda-picker-group";
        const groupTitle = document.createElement("h3");
        groupTitle.className = "prenda-picker-group-title";
        groupTitle.textContent = tipoNombre;
        groupEl.append(groupTitle);

        const grid = document.createElement("div");
        grid.className = "prenda-picker-grid";
        for (const row of rows) {
          const vm = toPrendaViewModel(row, { coloresCatalog: colores });
          const card = document.createElement("button");
          card.type = "button";
          card.className = "prenda-picker-card";
          card.classList.toggle("is-selected", selected.has(row.id));

          const thumb = document.createElement("div");
          thumb.className = "prenda-picker-thumb";
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
              .catch(() => thumb.classList.add("prenda-picker-thumb-empty"));
          } else {
            thumb.classList.add("prenda-picker-thumb-empty");
          }

          const name = document.createElement("span");
          name.className = "prenda-picker-name";
          name.textContent = vm.nombre;

          card.append(thumb, name);
          card.addEventListener("click", () => {
            if (selected.has(row.id)) selected.delete(row.id);
            else selected.add(row.id);
            card.classList.toggle("is-selected", selected.has(row.id));
            updateConfirmLabel();
          });

          grid.append(card);
        }
        groupEl.append(grid);
        body.append(groupEl);
      }
    }

    searchInput.addEventListener("input", () => renderGrid(searchInput.value));

    body.innerHTML = '<p class="prenda-picker-empty">Cargando...</p>';
    dialog.showModal();

    try {
      const [prendas, tiposPrenda, coloresCatalog] = await Promise.all([
        prendasRepo.list(),
        catalogosRepo.listTiposPrenda(),
        catalogosRepo.listColores(),
      ]);
      allPrendas = prendas;
      tiposById = new Map(tiposPrenda.map((t) => [t.id, t.nombre]));
      colores = coloresCatalog;
      renderGrid("");
    } catch (error) {
      body.innerHTML = "";
      const errorEl = document.createElement("p");
      errorEl.className = "prenda-picker-empty";
      errorEl.textContent = `No se pudieron cargar las prendas: ${error.message}`;
      body.append(errorEl);
    }
  });
}
