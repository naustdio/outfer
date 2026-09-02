import { validateTip } from "../../domain/validation.js";

// styling-tips "Tip Fields and CRUD": tip, descripcion, categoria are the
// only writable tip columns (0002_entities.sql). Every key emitted here
// MUST correspond to a control renderTipForm actually mounts below -- see
// prenda-form.js's readPrendaFormValues header for why that invariant
// matters (verify-report-pr2.md CRITICAL-1/2 family).
export function readTipFormValues(form) {
  const data = new FormData(form);
  return {
    tip: data.get("tip") ?? "",
    descripcion: data.get("descripcion") || null,
    categoria: data.getAll("categoria"),
  };
}

export function validateTipFormValues(values) {
  return validateTip(values);
}

// styling-tips "Dual Attachment": attaching/detaching is a write through
// linksRepo followed by a REFETCH of the tip's attachments via
// tipsRepo.getById() (which already returns { tip, outfits, prendas } --
// see tips.js) -- never a client-side splice/merge of the two independent
// relations. Extracted as plain functions so this is unit testable without
// a DOM/jsdom environment; see tests/unit/ui/tip-attach.test.js.
export async function handleAttachOutfit({ tipsRepo, linksRepo, tipId, outfitId }) {
  await linksRepo.linkOutfitTip(outfitId, tipId);
  return tipsRepo.getById(tipId);
}

export async function handleDetachOutfit({ tipsRepo, linksRepo, tipId, outfitId }) {
  await linksRepo.unlinkOutfitTip(outfitId, tipId);
  return tipsRepo.getById(tipId);
}

export async function handleAttachPrenda({ tipsRepo, linksRepo, tipId, prendaId }) {
  await linksRepo.linkPrendaTip(prendaId, tipId);
  return tipsRepo.getById(tipId);
}

export async function handleDetachPrenda({ tipsRepo, linksRepo, tipId, prendaId }) {
  await linksRepo.unlinkPrendaTip(prendaId, tipId);
  return tipsRepo.getById(tipId);
}

const CATEGORIA_OPTIONS = ["Colores", "Texturas", "Proporciones", "Accesorios", "Ocasion"];

function checkboxGroup(name, options, selected = []) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "checkbox-group";
  for (const option of options) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = option;
    input.checked = selected.includes(option);
    label.append(input, document.createTextNode(option));
    fieldset.append(label);
  }
  return fieldset;
}

function field(labelText, control, id) {
  const wrap = document.createElement("div");
  wrap.className = "form-field";
  const label = document.createElement("label");
  label.className = "eyebrow";
  label.textContent = labelText;
  if (id) {
    label.htmlFor = id;
    control.id = id;
  }
  wrap.append(label, control);
  return wrap;
}

function renderAttachmentSection(container, {
  title,
  attachedRows,
  attachedLabel,
  availableRows,
  availableLabel,
  onAttach,
  onDetach,
}) {
  const section = document.createElement("section");
  section.className = "attach-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading);

  const list = document.createElement("ul");
  list.className = "attach-list";
  if (attachedRows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Sin vincular.";
    list.append(empty);
  }
  for (const row of attachedRows) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = attachedLabel(row);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-ghost";
    removeButton.textContent = "Quitar";
    removeButton.addEventListener("click", () => onDetach(row));
    item.append(label, removeButton);
    list.append(item);
  }
  section.append(list);

  const form = document.createElement("form");
  form.className = "attach-form";
  const select = document.createElement("select");
  select.setAttribute("aria-label", title);
  for (const row of availableRows) {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = availableLabel(row);
    select.append(option);
  }
  const addButton = document.createElement("button");
  addButton.type = "submit";
  addButton.className = "btn";
  addButton.textContent = "Vincular";
  addButton.disabled = availableRows.length === 0;
  form.append(select, addButton);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!select.value) return;
    onAttach(select.value);
  });
  section.append(form);

  container.append(section);
}

// Mounts the create/edit tip form. The dual-attachment UI (attach/detach to
// outfits AND garments, independently -- styling-tips "Dual Attachment")
// only renders in edit mode: it needs an existing tip id, same reasoning as
// outfit-detail.js's garment-linking UI needing an existing outfit id.
// There is no separate tip-detail.js (tasks.md Phase 8 lists only
// tips-list.js + tip-form.js), so this screen does double duty as both the
// edit form and the attachment-management view.
export function renderTipForm(
  container,
  {
    tip = null,
    attachedOutfits = [],
    attachedPrendas = [],
    allOutfits = [],
    allPrendas = [],
    tipsRepo,
    linksRepo,
    onSaved,
    onCancel,
    onDeleted,
  },
) {
  container.innerHTML = "";

  const form = document.createElement("form");
  form.className = "tip-form";

  const heading = document.createElement("h1");
  heading.textContent = tip ? "Editar tip" : "Nuevo tip";
  form.append(heading);

  const tipInput = document.createElement("textarea");
  tipInput.name = "tip";
  tipInput.placeholder = "Tip";
  tipInput.value = tip?.tip ?? "";

  const descripcionInput = document.createElement("textarea");
  descripcionInput.name = "descripcion";
  descripcionInput.placeholder = "Descripcion";
  descripcionInput.value = tip?.descripcion ?? "";

  const categoriaField = checkboxGroup("categoria", CATEGORIA_OPTIONS, tip?.categoria ?? []);

  const errorList = document.createElement("ul");
  errorList.className = "form-errors";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "btn btn-primary";
  submitButton.textContent = tip ? "Guardar cambios" : "Crear tip";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "btn btn-ghost";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", () => onCancel?.());

  const formActions = document.createElement("div");
  formActions.className = "form-actions";
  formActions.append(submitButton, cancelButton);

  form.append(
    field("Tip", tipInput, "tip-tip"),
    field("Descripcion", descripcionInput, "tip-descripcion"),
    field("Categoria", categoriaField),
    errorList,
    formActions,
  );

  if (tip) {
    // styling-tips "Delete a tip": FKs on outfit_tip/prenda_tip cascade on
    // delete (0003_joins.sql), so this also removes both attachments --
    // matches prenda-detail.js's/outfit-detail.js's delete-button comments.
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger";
    deleteButton.textContent = "Eliminar tip";
    deleteButton.addEventListener("click", async () => {
      await tipsRepo.remove(tip.id);
      onDeleted?.(tip.id);
    });
    formActions.append(deleteButton);
  }

  container.className = "screen tip-form-screen";
  container.append(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorList.innerHTML = "";

    const values = readTipFormValues(form);
    const { valid, errors } = validateTipFormValues(values);
    if (!valid) {
      for (const message of Object.values(errors)) {
        const li = document.createElement("li");
        li.textContent = message;
        errorList.append(li);
      }
      return;
    }

    submitButton.disabled = true;
    try {
      const saved = tip ? await tipsRepo.update(tip.id, values) : await tipsRepo.create(values);
      onSaved?.(saved);
    } finally {
      submitButton.disabled = false;
    }
  });

  if (tip) {
    const attachedOutfitIds = new Set(attachedOutfits.map((row) => row.outfit_id));
    const attachedPrendaIds = new Set(attachedPrendas.map((row) => row.prenda_id));

    async function refreshAttachments() {
      const refetched = await tipsRepo.getById(tip.id);
      renderTipForm(container, {
        tip,
        attachedOutfits: refetched.outfits,
        attachedPrendas: refetched.prendas,
        allOutfits,
        allPrendas,
        tipsRepo,
        linksRepo,
        onSaved,
        onCancel,
        onDeleted,
      });
    }

    renderAttachmentSection(container, {
      title: "Outfits vinculados",
      attachedRows: allOutfits.filter((o) => attachedOutfitIds.has(o.id)),
      attachedLabel: (o) => o.titulo,
      availableRows: allOutfits.filter((o) => !attachedOutfitIds.has(o.id)),
      availableLabel: (o) => o.titulo,
      onAttach: async (outfitId) => {
        await handleAttachOutfit({ tipsRepo, linksRepo, tipId: tip.id, outfitId });
        await refreshAttachments();
      },
      onDetach: async (outfit) => {
        await handleDetachOutfit({ tipsRepo, linksRepo, tipId: tip.id, outfitId: outfit.id });
        await refreshAttachments();
      },
    });

    renderAttachmentSection(container, {
      title: "Prendas vinculadas",
      attachedRows: allPrendas.filter((p) => attachedPrendaIds.has(p.id)),
      attachedLabel: (p) => p.nombre,
      availableRows: allPrendas.filter((p) => !attachedPrendaIds.has(p.id)),
      availableLabel: (p) => p.nombre,
      onAttach: async (prendaId) => {
        await handleAttachPrenda({ tipsRepo, linksRepo, tipId: tip.id, prendaId });
        await refreshAttachments();
      },
      onDetach: async (prenda) => {
        await handleDetachPrenda({ tipsRepo, linksRepo, tipId: tip.id, prendaId: prenda.id });
        await refreshAttachments();
      },
    });
  }

  return form;
}
