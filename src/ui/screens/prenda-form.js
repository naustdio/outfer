import { validatePrenda } from "../../domain/validation.js";

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
// validatePrendaFormValues()/the repos expect. Not unit tested directly
// (DOM-only glue, no branching) -- covered indirectly once the form is
// exercised manually per design.md's Testing Strategy table.
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
    favorito: data.get("favorito") === "on",
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

function checkboxGroup(name, options, valueOf, labelOf, selected = []) {
  const fieldset = document.createElement("fieldset");
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

// Mounts the create/edit garment form. Submit reads the DOM, sanitizes +
// validates via validatePrendaFormValues() (unit tested above), and only
// calls the repo when valid -- matching garment-catalog's "reject a 4th
// color" / "flagging damage requires a damage type" scenarios. Not unit
// tested itself (DOM-only glue over already-tested pure functions) per
// design.md's Testing Strategy table.
export function renderPrendaForm(container, { prenda = null, coloresCatalog = [], tiposPrendaCatalog = [], prendasRepo, onSaved, onCancel }) {
  container.innerHTML = "";

  const form = document.createElement("form");
  form.className = "prenda-form";

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

  const coloresField = checkboxGroup(
    "colores",
    coloresCatalog,
    (c) => c.valor,
    (c) => c.nombre,
    prenda?.colores ?? [],
  );

  const fechaInput = document.createElement("input");
  fechaInput.type = "date";
  fechaInput.name = "fecha_ingreso";
  fechaInput.value = prenda?.fecha_ingreso ?? "";

  const cantidadInput = document.createElement("input");
  cantidadInput.type = "number";
  cantidadInput.name = "cantidad";
  cantidadInput.min = "1";
  cantidadInput.value = prenda?.cantidad ?? 1;

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
  danoField.hidden = !necesitaReparacionInput.checked;
  necesitaReparacionInput.addEventListener("change", () => {
    danoField.hidden = !necesitaReparacionInput.checked;
  });

  const errorList = document.createElement("ul");
  errorList.className = "form-errors";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = prenda ? "Guardar cambios" : "Crear prenda";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", () => onCancel?.());

  form.append(
    nombreInput,
    categoriaSelect,
    tipoSelect,
    coloresField,
    fechaInput,
    cantidadInput,
    necesitaReparacionInput,
    danoField,
    errorList,
    submitButton,
    cancelButton,
  );
  container.append(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorList.innerHTML = "";

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
      const saved = prenda
        ? await prendasRepo.update(prenda.id, clean)
        : await prendasRepo.create(clean);
      onSaved?.(saved);
    } finally {
      submitButton.disabled = false;
    }
  });

  return form;
}
