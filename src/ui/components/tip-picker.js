// Modal tip picker: search + multi-select, mirrors prenda-picker.js's
// dialog/search/confirm structure but as a text list (tips have no photo
// and no single grouping field worth splitting on). Used by outfit-detail.js
// so a tip can be attached directly from the outfit -- the outfit is the
// primary direction now; tip-form.js's own attach section still works as
// the secondary one (styling-tips "Dual Attachment" stays bidirectional).
//
// Returns a Promise that resolves with the array of newly selected tip rows
// on confirm, or null if the user cancels/closes without confirming.
export function openTipPicker({ tipsRepo, excludeIds = [] }) {
  return new Promise(async (resolve) => {
    const excluded = new Set(excludeIds);
    const selected = new Set();

    const dialog = document.createElement("dialog");
    dialog.className = "tip-picker-dialog";

    const heading = document.createElement("h2");
    heading.textContent = "Agregar tips";

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Buscar por texto o categoria...";
    searchInput.className = "tip-picker-search";

    const body = document.createElement("div");
    body.className = "tip-picker-body";

    const footer = document.createElement("div");
    footer.className = "tip-picker-footer";

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
    confirmButton.addEventListener("click", () => close(allTips.filter((t) => selected.has(t.id))));

    let allTips = [];

    function renderList(filterText) {
      body.innerHTML = "";
      const needle = filterText.trim().toLowerCase();

      const candidates = allTips.filter((t) => !excluded.has(t.id));
      const filtered = needle
        ? candidates.filter(
            (t) =>
              t.tip?.toLowerCase().includes(needle) ||
              (t.categoria ?? []).some((c) => c.toLowerCase().includes(needle)),
          )
        : candidates;

      if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "tip-picker-empty";
        empty.textContent = "No hay tips que coincidan.";
        body.append(empty);
        return;
      }

      const list = document.createElement("ul");
      list.className = "tip-picker-list";
      for (const row of filtered) {
        const item = document.createElement("li");
        item.className = "tip-picker-item";
        item.classList.toggle("is-selected", selected.has(row.id));

        const text = document.createElement("span");
        text.className = "tip-picker-item-text";
        text.textContent = row.tip;

        const meta = document.createElement("span");
        meta.className = "tip-picker-item-meta";
        meta.textContent = (row.categoria ?? []).join(", ") || "Sin categoria";

        item.append(text, meta);
        item.addEventListener("click", () => {
          if (selected.has(row.id)) selected.delete(row.id);
          else selected.add(row.id);
          item.classList.toggle("is-selected", selected.has(row.id));
          updateConfirmLabel();
        });

        list.append(item);
      }
      body.append(list);
    }

    searchInput.addEventListener("input", () => renderList(searchInput.value));

    body.innerHTML = '<p class="tip-picker-empty">Cargando...</p>';
    dialog.showModal();

    try {
      allTips = await tipsRepo.list();
      renderList("");
    } catch (error) {
      body.innerHTML = "";
      const errorEl = document.createElement("p");
      errorEl.className = "tip-picker-empty";
      errorEl.textContent = `No se pudieron cargar los tips: ${error.message}`;
      body.append(errorEl);
    }
  });
}
