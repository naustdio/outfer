import { validateOutfit } from "../../domain/validation.js";
import { validatePrendaFoto } from "../../data/storage.js";
import { openPrendaPicker } from "../components/prenda-picker.js";

// outfit-composition "Outfit Fields": titulo, imagen_inspiracion, notas,
// temporada are the only writable outfit columns (0002_entities.sql).
// estado/nombre_sugerido are derived and MUST NOT be settable here (spec:
// "MUST NOT be directly writable") -- same bug class as garment-catalog's
// disponible (verify-report-pr2.md CRITICAL-1/2 family). Every key emitted
// here MUST correspond to a control renderOutfitForm actually mounts below
// -- see prenda-form.js's readPrendaFormValues header for why that
// invariant matters. imagen_inspiracion is deliberately NOT read here: it
// can require an upload (see uploadPendingInspiracion below), so its final
// value is only known inside the submit handler, same division of labor as
// prenda-form.js's `fotos` field.
export function readOutfitFormValues(form) {
  const data = new FormData(form);
  return {
    titulo: data.get("titulo") ?? "",
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

const EXTERNAL_URL_RE = /^https?:\/\//i;

// Mounts the create/edit outfit form. Garment linking for an EXISTING
// outfit stays on outfit-detail.js (handleLinkGarment/handleUnlinkGarment)
// -- unchanged. This form additionally lets a NEW outfit collect garments
// before it has an id: selections are held in memory and linked right
// after outfitsRepo.create() succeeds, in the same submit transaction.
export function renderOutfitForm(
  container,
  { outfit = null, outfitsRepo, storageRepo, prendasRepo, catalogosRepo, linksRepo, onSaved, onCancel },
) {
  container.innerHTML = "";

  const form = document.createElement("form");
  form.className = "outfit-form";

  const heading = document.createElement("h1");
  heading.textContent = outfit ? "Editar outfit" : "Nuevo outfit";
  form.append(heading);

  const tituloInput = document.createElement("input");
  tituloInput.name = "titulo";
  tituloInput.placeholder = "Titulo";
  tituloInput.value = outfit?.titulo ?? "";

  // ---------- Imagen de inspiracion: drop/paste/file-picker/URL ----------
  const existingIsExternal = outfit?.imagen_inspiracion ? EXTERNAL_URL_RE.test(outfit.imagen_inspiracion) : false;
  let inspiracionFile = null;
  let inspiracionExistingPath = outfit?.imagen_inspiracion && !existingIsExternal ? outfit.imagen_inspiracion : null;
  let inspiracionObjectUrl = null;

  const dropZone = document.createElement("div");
  dropZone.className = "inspiracion-dropzone";
  dropZone.tabIndex = 0;

  const previewImg = document.createElement("img");
  previewImg.className = "inspiracion-preview";
  previewImg.alt = "Vista previa de la imagen de inspiracion";
  previewImg.hidden = true;

  const placeholder = document.createElement("p");
  placeholder.className = "inspiracion-placeholder";
  placeholder.textContent = "Arrastra una imagen, pegala (Ctrl+V), o haz clic para elegir un archivo";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;

  dropZone.append(previewImg, placeholder, fileInput);

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.placeholder = "...o pega un link de imagen";
  urlInput.value = existingIsExternal ? outfit.imagen_inspiracion : "";

  const removeInspiracionButton = document.createElement("button");
  removeInspiracionButton.type = "button";
  removeInspiracionButton.className = "btn btn-ghost inspiracion-remove";
  removeInspiracionButton.textContent = "Quitar imagen";
  removeInspiracionButton.hidden = !(inspiracionExistingPath || urlInput.value);

  const inspiracionError = document.createElement("p");
  inspiracionError.className = "inspiracion-error";
  inspiracionError.hidden = true;

  const inspiracionField = document.createElement("div");
  inspiracionField.className = "inspiracion-field";
  inspiracionField.append(dropZone, urlInput, removeInspiracionButton, inspiracionError);

  function revokeInspiracionObjectUrl() {
    if (inspiracionObjectUrl) {
      URL.revokeObjectURL(inspiracionObjectUrl);
      inspiracionObjectUrl = null;
    }
  }

  function showInspiracionPreview(src) {
    previewImg.src = src;
    previewImg.hidden = false;
    placeholder.hidden = true;
    removeInspiracionButton.hidden = false;
  }

  function clearInspiracionPreview() {
    previewImg.hidden = true;
    previewImg.removeAttribute("src");
    placeholder.hidden = false;
    removeInspiracionButton.hidden = true;
  }

  function setInspiracionFile(file) {
    const { valid, error } = validatePrendaFoto(file);
    if (!valid) {
      inspiracionError.textContent = error;
      inspiracionError.hidden = false;
      return;
    }
    inspiracionError.hidden = true;
    inspiracionFile = file;
    inspiracionExistingPath = null;
    urlInput.value = "";
    revokeInspiracionObjectUrl();
    inspiracionObjectUrl = URL.createObjectURL(file);
    showInspiracionPreview(inspiracionObjectUrl);
  }

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragover"));
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragover");
    const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (file) setInspiracionFile(file);
  });
  dropZone.addEventListener("paste", (event) => {
    const item = [...(event.clipboardData?.items ?? [])].find((it) => it.type.startsWith("image/"));
    if (!item) return;
    event.preventDefault();
    const file = item.getAsFile();
    if (file) setInspiracionFile(file);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) setInspiracionFile(fileInput.files[0]);
  });
  urlInput.addEventListener("input", () => {
    const url = urlInput.value.trim();
    inspiracionFile = null;
    inspiracionExistingPath = null;
    revokeInspiracionObjectUrl();
    inspiracionError.hidden = true;
    if (url) showInspiracionPreview(url);
    else clearInspiracionPreview();
  });
  removeInspiracionButton.addEventListener("click", () => {
    inspiracionFile = null;
    inspiracionExistingPath = null;
    urlInput.value = "";
    inspiracionError.hidden = true;
    revokeInspiracionObjectUrl();
    clearInspiracionPreview();
  });

  if (inspiracionExistingPath && storageRepo) {
    storageRepo
      .getPrendaFotoUrl(inspiracionExistingPath)
      .then(showInspiracionPreview)
      .catch(() => {
        inspiracionError.textContent = "No se pudo cargar la imagen guardada.";
        inspiracionError.hidden = false;
      });
  } else if (urlInput.value) {
    showInspiracionPreview(urlInput.value);
  }

  const notasInput = document.createElement("textarea");
  notasInput.name = "notas";
  notasInput.placeholder = "Notas";
  notasInput.value = outfit?.notas ?? "";

  const temporadaField = checkboxGroup("temporada", TEMPORADA_OPTIONS, outfit?.temporada ?? []);

  // ---------- Prendas: only offered for a NEW outfit (see header comment) ----------
  const canPickPrendas = !outfit && prendasRepo && catalogosRepo && linksRepo;
  const selectedPrendaIds = new Set();
  const selectedPrendasCache = new Map();
  let prendasField = null;

  if (canPickPrendas) {
    const chipsList = document.createElement("ul");
    chipsList.className = "outfit-prenda-chips";

    const addPrendaButton = document.createElement("button");
    addPrendaButton.type = "button";
    addPrendaButton.className = "btn";
    addPrendaButton.textContent = "+ Agregar prenda";

    prendasField = document.createElement("div");
    prendasField.className = "outfit-prendas-field";
    prendasField.append(chipsList, addPrendaButton);

    function renderChips() {
      chipsList.innerHTML = "";
      if (selectedPrendaIds.size === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "Sin prendas agregadas todavia.";
        chipsList.append(empty);
        return;
      }
      for (const id of selectedPrendaIds) {
        const row = selectedPrendasCache.get(id);
        const chip = document.createElement("li");
        chip.className = "outfit-prenda-chip";

        const thumb = document.createElement("div");
        thumb.className = "outfit-prenda-chip-thumb";
        const firstFoto = row?.fotos?.[0];
        if (firstFoto && storageRepo) {
          const img = document.createElement("img");
          img.alt = row.nombre ?? "";
          thumb.append(img);
          storageRepo
            .getPrendaFotoUrl(firstFoto)
            .then((url) => {
              img.src = url;
            })
            .catch(() => {});
        }

        const name = document.createElement("span");
        name.textContent = row?.nombre ?? "Prenda";

        const removeChip = document.createElement("button");
        removeChip.type = "button";
        removeChip.className = "outfit-prenda-chip-remove";
        removeChip.textContent = "×";
        removeChip.setAttribute("aria-label", `Quitar ${row?.nombre ?? "prenda"}`);
        removeChip.addEventListener("click", () => {
          selectedPrendaIds.delete(id);
          renderChips();
        });

        chip.append(thumb, name, removeChip);
        chipsList.append(chip);
      }
    }
    renderChips();

    addPrendaButton.addEventListener("click", async () => {
      addPrendaButton.disabled = true;
      try {
        const picked = await openPrendaPicker({
          prendasRepo,
          storageRepo,
          catalogosRepo,
          excludeIds: [...selectedPrendaIds],
        });
        if (!picked) return;
        for (const row of picked) {
          selectedPrendaIds.add(row.id);
          selectedPrendasCache.set(row.id, row);
        }
        renderChips();
      } finally {
        addPrendaButton.disabled = false;
      }
    });
  }

  const errorList = document.createElement("ul");
  errorList.className = "form-errors";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "btn btn-primary";
  submitButton.textContent = outfit ? "Guardar cambios" : "Crear outfit";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "btn btn-ghost";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", () => onCancel?.());

  const formActions = document.createElement("div");
  formActions.className = "form-actions";
  formActions.append(submitButton, cancelButton);

  form.append(
    field("Titulo", tituloInput, "outfit-titulo"),
    field("Imagen de inspiracion", inspiracionField),
    field("Notas", notasInput, "outfit-notas"),
    field("Temporada", temporadaField),
    ...(prendasField ? [field("Prendas", prendasField)] : []),
    errorList,
    formActions,
  );
  container.className = "screen outfit-form-screen";
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
      let saved;
      if (outfit) {
        let imagen_inspiracion = inspiracionExistingPath;
        if (inspiracionFile) {
          imagen_inspiracion = await storageRepo.uploadOutfitInspiracion(outfit.id, inspiracionFile);
        } else if (urlInput.value.trim()) {
          imagen_inspiracion = urlInput.value.trim();
        }
        saved = await outfitsRepo.update(outfit.id, { ...values, imagen_inspiracion });
      } else {
        const created = await outfitsRepo.create({
          ...values,
          imagen_inspiracion: inspiracionFile ? null : urlInput.value.trim() || null,
        });
        saved = created;
        if (inspiracionFile) {
          const imagen_inspiracion = await storageRepo.uploadOutfitInspiracion(created.id, inspiracionFile);
          saved = await outfitsRepo.update(created.id, { imagen_inspiracion });
        }
        for (const id of selectedPrendaIds) {
          await linksRepo.linkOutfitPrenda(created.id, id);
        }
      }
      onSaved?.(saved);
    } catch (error) {
      inspiracionError.textContent = `Error al guardar: ${error.message}`;
      inspiracionError.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  return form;
}
