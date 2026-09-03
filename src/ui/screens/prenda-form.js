import { validatePrenda } from "../../domain/validation.js";
import { validatePrendaFoto } from "../../data/storage.js";

// Clears damage detail when the flag is off -- garment-catalog spec
// "Clearing damage flag clears damage detail": tipo_dano/detalle_dano must
// no longer be treated as active damage data once necesita_reparacion is
// false, so the form's own save path enforces that rather than just hiding
// the fields in the UI.
export function sanitizePrendaFormValues(values) {
  if (!values.necesita_reparacion) {
    return { ...values, tipo_dano: [], detalle_dano: null };
  }
  return values;
}

// Single entry point the form's submit handler uses: sanitize first, then
// delegate the actual rules to domain/validation.js (mirrors DB
// constraints -- design.md "What is left client-side").
export function validatePrendaFormValues(values) {
  return validatePrenda(sanitizePrendaFormValues(values));
}

// Reads a submitted <form> into the plain-object shape
// validatePrendaFormValues()/the repos expect. Covered by the DOM tests in
// tests/unit/ui/prenda-form.test.js via renderPrendaForm's submit handler
// (jsdom environment) -- every key here must correspond to a control
// renderPrendaForm actually mounts, or the value silently degrades to null.
export function readPrendaFormValues(form) {
  const data = new FormData(form);
  return {
    nombre: data.get("nombre") ?? "",
    categoria: data.get("categoria") || null,
    tipo_prenda_id: data.get("tipo_prenda_id") || null,
    colores: data.getAll("colores"),
    talla: data.get("talla") || null,
    fecha_ingreso: data.get("fecha_ingreso") || null,
    cantidad: data.get("cantidad") ? Number(data.get("cantidad")) : undefined,
    precio: data.get("precio") ? Number(data.get("precio")) : undefined,
    temporada: data.getAll("temporada"),
    favorito: data.get("favorito") === "on",
    estado: data.get("estado") || undefined,
    necesita_reparacion: data.get("necesita_reparacion") === "on",
    tipo_dano: data.getAll("tipo_dano"),
    detalle_dano: data.get("detalle_dano") || null,
  };
}

const DANO_OPTIONS = [
  "Costura/Bastilla",
  "Boton",
  "Cierre",
  "Mancha",
  "Descosido",
  "Desgaste",
  "Otro",
];

// garment-catalog "Garment Fields": estado_prenda enum (0001_types_and_lookups.sql).
const ESTADO_OPTIONS = ["En closet", "Por comprar"];

// garment-catalog "Garment Fields": temporada is multi-select; temporada[]
// enum (0001_types_and_lookups.sql).
const TEMPORADA_OPTIONS = ["Primavera", "Verano", "Otono", "Invierno", "Atemporal"];

function checkboxGroup(name, options, valueOf, labelOf, selected = []) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "checkbox-group";
  for (const option of options) {
    const value = valueOf(option);
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    input.checked = selected.includes(value);
    label.append(input, document.createTextNode(labelOf(option)));
    fieldset.append(label);
  }
  return fieldset;
}

// Wraps a single control with its uppercase eyebrow label for layout only --
// the control keeps its own `name`/`id`, readPrendaFormValues() is untouched.
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

// Mounts the create/edit garment form. Submit reads the DOM, sanitizes +
// validates via validatePrendaFormValues() (unit tested above), and only
// calls the repo when valid -- matching garment-catalog's "reject a 4th
// color" / "flagging damage requires a damage type" scenarios. Unit tested
// via jsdom in tests/unit/ui/prenda-form.test.js: every field mounted here
// must also be read back in readPrendaFormValues(), or an edit that leaves
// that field untouched will silently overwrite it with null.
export function renderPrendaForm(
  container,
  {
    prenda = null,
    coloresCatalog = [],
    tiposPrendaCatalog = [],
    prendasRepo,
    storageRepo,
    catalogosRepo,
    onSaved,
    onCancel,
  },
) {
  container.innerHTML = "";

  // fotos state: `currentFotos` holds already-uploaded Storage paths
  // (prenda.fotos when editing); `pendingFiles` holds File objects selected
  // in this session but not yet uploaded. Both are mutated in place by the
  // preview UI below and only touch the network (storageRepo) on submit for
  // pendingFiles, or immediately on "Quitar" for an already-uploaded photo
  // (this task's brief: removing a photo must delete the underlying Storage
  // object, not just detach it from the array -- avoids orphaned files).
  let currentFotos = [...(prenda?.fotos ?? [])];
  let pendingFiles = [];

  const form = document.createElement("form");
  form.className = "prenda-form";

  const heading = document.createElement("h1");
  heading.textContent = prenda ? "Editar prenda" : "Nueva prenda";
  form.append(heading);

  const nombreInput = document.createElement("input");
  nombreInput.name = "nombre";
  nombreInput.placeholder = "Nombre";
  nombreInput.value = prenda?.nombre ?? "";

  const categoriaSelect = document.createElement("select");
  categoriaSelect.name = "categoria";
  for (const categoria of ["Superior", "Inferior", "Pies", "Accesorios"]) {
    const option = document.createElement("option");
    option.value = categoria;
    option.textContent = categoria;
    option.selected = prenda?.categoria === categoria;
    categoriaSelect.append(option);
  }

  const tipoSelect = document.createElement("select");
  tipoSelect.name = "tipo_prenda_id";
  for (const tipo of tiposPrendaCatalog) {
    const option = document.createElement("option");
    option.value = tipo.id;
    option.textContent = tipo.nombre;
    option.selected = prenda?.tipo_prenda_id === tipo.id;
    tipoSelect.append(option);
  }

  // Tipo de prenda is a growable lookup (see supabase/migrations/0001, RLS
  // policy "add_tipo"): any authenticated user can add a new type at runtime
  // instead of being stuck with the seeded list. Only offered when the
  // caller wires catalogosRepo (main.js does; the unit tests for this form
  // don't need to and can leave it out).
  const NEW_TIPO_VALUE = "__new__";
  let lastTipoValue = tipoSelect.value;
  let newTipoField = null;

  if (catalogosRepo) {
    const newTipoOption = document.createElement("option");
    newTipoOption.value = NEW_TIPO_VALUE;
    newTipoOption.textContent = "+ Agregar nuevo tipo...";
    tipoSelect.append(newTipoOption);

    newTipoField = document.createElement("div");
    newTipoField.className = "new-tipo-field";
    newTipoField.hidden = true;

    const newTipoNombreInput = document.createElement("input");
    newTipoNombreInput.placeholder = "Nombre del nuevo tipo";

    const newTipoCategoriaSelect = document.createElement("select");
    for (const categoria of ["Superior", "Inferior", "Pies", "Accesorios"]) {
      const option = document.createElement("option");
      option.value = categoria;
      option.textContent = categoria;
      newTipoCategoriaSelect.append(option);
    }

    const newTipoConfirmButton = document.createElement("button");
    newTipoConfirmButton.type = "button";
    newTipoConfirmButton.className = "btn";
    newTipoConfirmButton.textContent = "Agregar";

    const newTipoCancelButton = document.createElement("button");
    newTipoCancelButton.type = "button";
    newTipoCancelButton.className = "btn btn-ghost";
    newTipoCancelButton.textContent = "Cancelar";

    const newTipoError = document.createElement("p");
    newTipoError.className = "new-tipo-error";
    newTipoError.hidden = true;

    newTipoField.append(
      newTipoNombreInput,
      newTipoCategoriaSelect,
      newTipoConfirmButton,
      newTipoCancelButton,
      newTipoError,
    );

    function closeNewTipoField() {
      newTipoField.hidden = true;
      newTipoNombreInput.value = "";
      newTipoError.hidden = true;
      tipoSelect.value = lastTipoValue;
    }

    tipoSelect.addEventListener("change", () => {
      if (tipoSelect.value === NEW_TIPO_VALUE) {
        newTipoField.hidden = false;
        newTipoNombreInput.focus();
      } else {
        lastTipoValue = tipoSelect.value;
      }
    });

    newTipoCancelButton.addEventListener("click", closeNewTipoField);

    newTipoConfirmButton.addEventListener("click", async () => {
      const nombre = newTipoNombreInput.value.trim();
      if (!nombre) {
        newTipoError.textContent = "Escribe un nombre.";
        newTipoError.hidden = false;
        return;
      }
      newTipoConfirmButton.disabled = true;
      try {
        const created = await catalogosRepo.createTipoPrenda({
          nombre,
          categoria: newTipoCategoriaSelect.value,
        });
        const option = document.createElement("option");
        option.value = created.id;
        option.textContent = created.nombre;
        tipoSelect.insertBefore(option, newTipoOption);
        tipoSelect.value = created.id;
        lastTipoValue = created.id;
        closeNewTipoField();
      } catch (error) {
        newTipoError.textContent =
          error.code === "23505"
            ? `Ya existe un tipo llamado "${nombre}".`
            : `No se pudo agregar: ${error.message}`;
        newTipoError.hidden = false;
      } finally {
        newTipoConfirmButton.disabled = false;
      }
    });
  }

  const coloresField = checkboxGroup(
    "colores",
    coloresCatalog,
    (c) => c.valor,
    (c) => c.nombre,
    prenda?.colores ?? [],
  );

  const tallaInput = document.createElement("input");
  tallaInput.name = "talla";
  tallaInput.placeholder = "Talla";
  tallaInput.value = prenda?.talla ?? "";

  const fechaInput = document.createElement("input");
  fechaInput.type = "date";
  fechaInput.name = "fecha_ingreso";
  fechaInput.value = prenda?.fecha_ingreso ?? "";

  const cantidadInput = document.createElement("input");
  cantidadInput.type = "number";
  cantidadInput.name = "cantidad";
  cantidadInput.min = "1";
  cantidadInput.value = prenda?.cantidad ?? 1;

  const temporadaField = checkboxGroup(
    "temporada",
    TEMPORADA_OPTIONS,
    (t) => t,
    (t) => t,
    prenda?.temporada ?? [],
  );

  const estadoSelect = document.createElement("select");
  estadoSelect.name = "estado";
  for (const estado of ESTADO_OPTIONS) {
    const option = document.createElement("option");
    option.value = estado;
    option.textContent = estado;
    option.selected = (prenda?.estado ?? ESTADO_OPTIONS[0]) === estado;
    estadoSelect.append(option);
  }

  const favoritoLabel = document.createElement("label");
  favoritoLabel.className = "checkbox-field";
  const favoritoInput = document.createElement("input");
  favoritoInput.type = "checkbox";
  favoritoInput.name = "favorito";
  favoritoInput.checked = prenda?.favorito ?? false;
  favoritoLabel.append(favoritoInput, document.createTextNode("Favorito"));

  const necesitaReparacionInput = document.createElement("input");
  necesitaReparacionInput.type = "checkbox";
  necesitaReparacionInput.name = "necesita_reparacion";
  necesitaReparacionInput.checked = prenda?.necesita_reparacion ?? false;

  const danoField = checkboxGroup(
    "tipo_dano",
    DANO_OPTIONS,
    (d) => d,
    (d) => d,
    prenda?.tipo_dano ?? [],
  );

  const detalleDanoInput = document.createElement("input");
  detalleDanoInput.name = "detalle_dano";
  detalleDanoInput.placeholder = "Detalle del dano";
  detalleDanoInput.value = prenda?.detalle_dano ?? "";
  danoField.append(detalleDanoInput);

  danoField.hidden = !necesitaReparacionInput.checked;
  necesitaReparacionInput.addEventListener("change", () => {
    danoField.hidden = !necesitaReparacionInput.checked;
  });

  // ---------- Fotos: file input + preview grid ----------
  const fotosField = document.createElement("div");
  fotosField.className = "fotos-field";

  const fotosPreview = document.createElement("div");
  fotosPreview.className = "fotos-preview";

  const uploadStatus = document.createElement("p");
  uploadStatus.className = "upload-status";
  uploadStatus.hidden = true;

  function showUploadStatus(message) {
    uploadStatus.hidden = false;
    uploadStatus.textContent = message;
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.name = "fotos_input";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  fileInput.className = "fotos-input";

  // Signed URLs (private bucket, see src/data/storage.js) are fetched fresh
  // every render rather than cached -- correctness over premature
  // optimization, matching this task's brief.
  function renderFotosPreview() {
    fotosPreview.innerHTML = "";

    for (const path of currentFotos) {
      const tile = document.createElement("div");
      tile.className = "foto-tile";

      const img = document.createElement("img");
      img.alt = "Foto de la prenda";
      tile.append(img);
      if (storageRepo) {
        storageRepo
          .getPrendaFotoUrl(path)
          .then((url) => {
            img.src = url;
          })
          .catch((error) => showUploadStatus(`No se pudo cargar una foto: ${error.message}`));
      }

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "foto-remove";
      removeButton.textContent = "Quitar";
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        try {
          if (storageRepo) await storageRepo.deletePrendaFoto(path);
          currentFotos = currentFotos.filter((p) => p !== path);
          renderFotosPreview();
        } catch (error) {
          showUploadStatus(`No se pudo eliminar la foto: ${error.message}`);
          removeButton.disabled = false;
        }
      });
      tile.append(removeButton);
      fotosPreview.append(tile);
    }

    pendingFiles.forEach((file, index) => {
      const tile = document.createElement("div");
      tile.className = "foto-tile foto-tile-pending";

      const img = document.createElement("img");
      img.alt = "Foto nueva (sin subir)";
      img.src = URL.createObjectURL(file);
      tile.append(img);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "foto-remove";
      removeButton.textContent = "Quitar";
      removeButton.addEventListener("click", () => {
        pendingFiles = pendingFiles.filter((_, i) => i !== index);
        renderFotosPreview();
      });
      tile.append(removeButton);
      fotosPreview.append(tile);
    });

    if (currentFotos.length === 0 && pendingFiles.length === 0) {
      const empty = document.createElement("p");
      empty.className = "fotos-empty";
      empty.textContent = "Sin fotos todavia.";
      fotosPreview.append(empty);
    }
  }

  fileInput.addEventListener("change", () => {
    const errors = [];
    for (const file of fileInput.files) {
      const { valid, error } = validatePrendaFoto(file);
      if (valid) pendingFiles.push(file);
      else errors.push(error);
    }
    fileInput.value = "";
    if (errors.length > 0) showUploadStatus(errors.join(" "));
    renderFotosPreview();
  });

  renderFotosPreview();
  fotosField.append(fotosPreview, fileInput, uploadStatus);

  const errorList = document.createElement("ul");
  errorList.className = "form-errors";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "btn btn-primary";
  submitButton.textContent = prenda ? "Guardar cambios" : "Crear prenda";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "btn btn-ghost";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", () => onCancel?.());

  const necesitaReparacionField = document.createElement("div");
  necesitaReparacionField.className = "checkbox-field";
  necesitaReparacionField.append(necesitaReparacionInput, document.createTextNode("Necesita reparacion"));

  const formActions = document.createElement("div");
  formActions.className = "form-actions";
  formActions.append(submitButton, cancelButton);

  form.append(
    field("Nombre", nombreInput, "prenda-nombre"),
    field("Categoria", categoriaSelect, "prenda-categoria"),
    field("Tipo de prenda", tipoSelect, "prenda-tipo"),
    ...(newTipoField ? [newTipoField] : []),
    field("Colores", coloresField),
    field("Talla", tallaInput, "prenda-talla"),
    field("Fecha de ingreso", fechaInput, "prenda-fecha"),
    field("Cantidad", cantidadInput, "prenda-cantidad"),
    field("Fotos", fotosField),
    field("Temporada", temporadaField),
    field("Estado", estadoSelect, "prenda-estado"),
    favoritoLabel,
    necesitaReparacionField,
    danoField,
    errorList,
    formActions,
  );
  container.className = "screen prenda-form-screen";
  container.append(form);

  // Uploads every pending File under the given prenda id (in order) and
  // returns the resulting Storage paths. Left as a loop rather than
  // Promise.all so upload failures fail on the first bad file with a clear
  // error instead of a Promise.all rejection swallowing which file failed.
  async function uploadPendingFiles(prendaId) {
    const uploaded = [];
    for (const file of pendingFiles) {
      const path = await storageRepo.uploadPrendaFoto(prendaId, file);
      uploaded.push(path);
    }
    return uploaded;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorList.innerHTML = "";
    uploadStatus.hidden = true;

    const values = readPrendaFormValues(form);
    const { valid, errors } = validatePrendaFormValues(values);
    if (!valid) {
      for (const message of Object.values(errors)) {
        const li = document.createElement("li");
        li.textContent = message;
        errorList.append(li);
      }
      return;
    }

    const clean = sanitizePrendaFormValues(values);
    submitButton.disabled = true;
    try {
      let saved;
      if (prenda) {
        let fotos = [...currentFotos];
        if (pendingFiles.length > 0) {
          showUploadStatus("Subiendo...");
          fotos = fotos.concat(await uploadPendingFiles(prenda.id));
        }
        saved = await prendasRepo.update(prenda.id, { ...clean, fotos });
      } else {
        // A brand-new garment has no id to scope the Storage path under
        // (see buildPrendaFotoPath's {user_id}/{prenda_id}/... convention),
        // so the row is created first, then any pending files are uploaded
        // against the real id, then the row is patched with the resulting
        // fotos paths.
        const created = await prendasRepo.create({ ...clean, fotos: [] });
        if (pendingFiles.length > 0) {
          showUploadStatus("Subiendo...");
          const fotos = await uploadPendingFiles(created.id);
          saved = await prendasRepo.update(created.id, { fotos });
        } else {
          saved = created;
        }
      }
      pendingFiles = [];
      onSaved?.(saved);
    } catch (error) {
      // Never swallow silently -- see main.js's service-worker registration
      // comment for why this codebase treats a silent failure as a bug.
      showUploadStatus(`Error al guardar: ${error.message}`);
    } finally {
      submitButton.disabled = false;
    }
  });

  return form;
}
