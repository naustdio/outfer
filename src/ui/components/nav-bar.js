// Persistent bottom navigation. Rendered ONCE by src/main.js into the
// #app-nav sibling of #app (see public/index.html) -- it lives OUTSIDE the
// router-owned container so it survives every screen's `container.innerHTML
// = ""` reset (src/ui/router.js's render() hands each route handler `root`,
// which is #app, never #app-nav).
//
// Deliberately decoupled from src/ui/router.js: rather than subscribing to
// the router (which has no such publish/subscribe contract and shouldn't
// grow one just for this), the nav bar derives the active tab straight from
// window.location.hash via its own hashchange listener. That keeps
// router.js's public API/behavior untouched, so tests/unit/ui/router.test.js
// and tests/unit/ui/app.test.js need no changes.
//
// Not unit tested as a DOM-mounting function, per this project's established
// "DOM screens are manual/E2E" convention (see prendas-list.js, login.js
// header comments) -- isTabActive below is the one pure/testable piece and
// is covered by tests/unit/ui/nav-bar.test.js.

const TABS = [
  { path: "/prendas", label: "Prendas" },
  { path: "/outfits", label: "Outfits" },
  { path: "/tips", label: "Tips" },
  { path: "/search", label: "Buscar" },
];

// Mirrors router.js's parseHash normalization ("#/prendas" -> "/prendas",
// "" -> "/") without importing it -- see header comment on why this file
// stays decoupled from router.js.
function parseHash(hash) {
  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw || raw === "/") return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

// A tab stays active for its own path and any nested path under it -- e.g.
// "/prendas/123" or "/prendas/new" both keep the Prendas tab highlighted.
export function isTabActive(tabPath, currentPath) {
  return currentPath === tabPath || currentPath.startsWith(`${tabPath}/`);
}

// `container` is expected to already be the <nav id="app-nav"> element from
// index.html. `onSignOut` is injected (matches every screen's convention of
// receiving repos/services from src/main.js rather than importing them
// directly) so this file never imports src/data/auth.js itself. `window` is
// injectable for the same reason router.js's is: testability, though this
// function itself isn't unit tested today.
export function renderNavBar(container, { onSignOut, window: win = window } = {}) {
  container.innerHTML = "";
  container.setAttribute("aria-label", "Navegacion principal");

  const list = document.createElement("ul");
  list.className = "app-nav-list";

  const tabLinks = TABS.map((tab) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "app-nav-tab";
    link.href = `#${tab.path}`;
    link.textContent = tab.label;
    item.append(link);
    list.append(item);
    return { tab, link };
  });

  const signOutItem = document.createElement("li");
  const signOutButton = document.createElement("button");
  signOutButton.type = "button";
  signOutButton.className = "app-nav-tab app-nav-signout";
  signOutButton.textContent = "Salir";
  signOutButton.setAttribute("aria-label", "Cerrar sesion");
  signOutButton.addEventListener("click", () => onSignOut?.());
  signOutItem.append(signOutButton);
  list.append(signOutItem);

  container.append(list);

  function updateActiveTab() {
    const current = parseHash(win.location.hash);
    for (const { tab, link } of tabLinks) {
      const active = isTabActive(tab.path, current);
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  updateActiveTab();
  win.addEventListener("hashchange", updateActiveTab);

  return {
    // Not called anywhere today (the nav is mounted once for the app's
    // whole lifetime), but exposed for symmetry with router.js's own
    // reset() and so a future teardown path has somewhere to hook in.
    destroy() {
      win.removeEventListener("hashchange", updateActiveTab);
    },
  };
}
