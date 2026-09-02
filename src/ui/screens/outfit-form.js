import { validateOutfit } from "../../domain/validation.js";

// outfit-composition "Outfit Fields": titulo, imagen_inspiracion, notas,
// temporada are the only writable outfit columns (0002_entities.sql).
// estado/nombre_sugerido are derived and MUST NOT be settable here (spec:
// "MUST NOT be directly writable") -- same bug class as garment-catalog's
// disponible (verify-report-pr2.md CRITICAL-1/2 family). Every key emitted
// here MUST correspond to a control renderOutfitForm actually mounts below
// -- see prenda-form.js's readPrendaFormValues header for why that
// invariant matters.
export function readOutfitFormValues(form) {
  const data = new FormData(form);
  return {
    titulo: data.get("titulo") ?? "",
    imagen_inspiracion: data.get("imagen_inspiracion") || null,
    notas: data.get("notas") || null,
    temporada: data.getAll("temporada"),
  };
}

export function validateOutfitFormValues(values) {
  return validateOutfit(values);
}

const TEMPORADA_OPTIONS = ["Primavera", "Verano", "Otono", "Invierno", "Atemporal"];

function checkboxGroup(name, options, selected = []) {
  const fieldset = document.createElement("fieldset");
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

// Mounts the create/edit outfit form. Garment linking (M:N to prenda) is
// deliberately NOT here -- it needs an existing outfit id, so it lives in
// outfit-detail.js (handleLinkGarment/handleUnlinkGarment), same reasoning
// as tip-form.js's attach/detach section only rendering in edit mode.
export function renderOutfitForm(container, { outfit = null, outfitsRepo, onSaved, onCancel }) {
  container.innerHTML = "";

  const form = document.createElement("form");
  form.className = "outfit-form";

  const tituloInput = document.createElement("input");
  tituloInput.name = "titulo";
  tituloInput.placeholder = "Titulo";
  tituloInput.value = outfit?.titulo ?? "";

  const imagenInput = document.createElement("input");
  imagenInput.name = "imagen_inspiracion";
  imagenInput.placeholder = "Imagen de inspiracion (URL)";
  imagenInput.value = outfit?.imagen_inspiracion ?? "";

  const notasInput = document.createElement("textarea");
  notasInput.name = "notas";
  notasInput.placeholder = "Notas";
  notasInput.value = outfit?.notas ?? "";

  const temporadaField = checkboxGroup("temporada", TEMPORADA_OPTIONS, outfit?.temporada ?? []);

  const errorList = document.createElement("ul");
  errorList.className = "form-errors";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = outfit ? "Guardar cambios" : "Crear outfit";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", () => onCancel?.());

  form.append(
    tituloInput,
    imagenInput,
    notasInput,
    temporadaField,
    errorList,
    submitButton,
    cancelButton,
  );
  container.append(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorList.innerHTML = "";

    const values = readOutfitFormValues(form);
    const { valid, errors } = validateOutfitFormValues(values);
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
      const saved = outfit
        ? await outfitsRepo.update(outfit.id, values)
        : await outfitsRepo.create(values);
      onSaved?.(saved);
    } finally {
      submitButton.disabled = false;
    }
  });

  return form;
}
