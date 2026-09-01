// Email/password sign-in screen. UX only -- see design.md "Auth and
// session gating": the login screen is not the security boundary, RLS is.
// No automated test per design.md's Testing Strategy table (DOM screens are
// manual/E2E for this change); the auth call itself is already covered by
// tests/unit/data/auth.test.js.
export function renderLogin(container, { auth, onSignedIn } = {}) {
  container.innerHTML = "";

  const form = document.createElement("form");
  form.className = "login-form";

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.name = "email";
  emailInput.placeholder = "Email";
  emailInput.required = true;
  emailInput.autocomplete = "username";

  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.name = "password";
  passwordInput.placeholder = "Contrasena";
  passwordInput.required = true;
  passwordInput.autocomplete = "current-password";

  const errorEl = document.createElement("p");
  errorEl.className = "login-error";
  errorEl.hidden = true;
  errorEl.setAttribute("role", "alert");

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Entrar";

  form.append(emailInput, passwordInput, errorEl, submitButton);
  container.append(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    submitButton.disabled = true;
    try {
      await auth.signIn(emailInput.value, passwordInput.value);
      onSignedIn?.();
    } catch {
      errorEl.textContent = "Credenciales invalidas. Intenta de nuevo.";
      errorEl.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  return form;
}
