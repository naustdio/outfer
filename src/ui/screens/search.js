// unified-search "Cross-Entity Search" + "Search Respects Ownership Scope":
// one round trip via searchRepo.search(q) (src/data/search.js ->
// client.rpc('search_all', { q })), grouped by `tipo` here in the UI layer
// per design.md's Interfaces/Contracts comment ("UI groups by `tipo`; the
// RPC never has to know about grouping") -- RLS on the underlying tables is
// what actually enforces ownership scope (design.md decision 5/6), this
// screen never filters by user_id itself.
//
// No persistent header/nav exists anywhere in this app yet (established
// convention since Phase 6.5 -- see prendas-list.js/outfit-detail.js
// headers and apply-progress's manual click-path notes: navigation between
// screens is via the hash bar, not a nav bar). Rather than introduce new UI
// chrome outside the router's owned #app container, unified search is wired
// as its own route (`/search`, see main.js) -- consistent with how every
// other screen in this change is reached.
//
// groupSearchHits is extracted as a plain function (same convention as
// outfit-detail.js's handleLinkGarment/tip-form.js's handleAttachOutfit) so
// the grouping contract is unit testable without a DOM/jsdom environment;
// see tests/unit/ui/search.test.js.
export function groupSearchHits(hits) {
  const groups = { prenda: [], outfit: [], tip: [] };
  for (const hit of hits) {
    groups[hit.tipo]?.push(hit);
  }
  return groups;
}

const GROUP_LABELS = { prenda: "Prendas", outfit: "Outfits", tip: "Tips" };

// Simple setTimeout-based debounce -- no framework/dependency needed for a
// single search input (design.md: vanilla ES modules, no build step).
const DEBOUNCE_MS = 300;

// Renders the search screen: a single input, debounced, calling
// searchRepo.search(q) and rendering results grouped by type. Not unit
// tested itself per design.md's Testing Strategy table (DOM screens are
// manual/E2E for this change) -- the testable logic is groupSearchHits
// above.
export function renderSearch(container, { searchRepo, onSelect }) {
  container.innerHTML = "";

  const screen = document.createElement("div");
  screen.className = "screen search-screen";

  const heading = document.createElement("h1");
  heading.textContent = "Buscar";
  screen.append(heading);

  const form = document.createElement("form");
  form.className = "search-form";
  form.addEventListener("submit", (event) => event.preventDefault());

  const input = document.createElement("input");
  input.type = "search";
  input.name = "q";
  input.placeholder = "Buscar prendas, outfits, tips...";
  input.setAttribute("aria-label", "Buscar prendas, outfits, tips");
  form.append(input);

  const status = document.createElement("p");
  status.className = "search-status";
  status.setAttribute("role", "status");

  const results = document.createElement("div");
  results.className = "search-results";

  screen.append(form, status, results);
  container.append(screen);

  let debounceTimer = null;
  let requestId = 0;

  function renderGroups(groups) {
    results.innerHTML = "";
    for (const tipo of ["prenda", "outfit", "tip"]) {
      const hits = groups[tipo];
      const section = document.createElement("section");
      section.className = `search-group search-group-${tipo}`;

      const heading = document.createElement("h3");
      heading.textContent = GROUP_LABELS[tipo];
      section.append(heading);

      const list = document.createElement("ul");
      if (hits.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "Sin resultados.";
        list.append(empty);
      }
      for (const hit of hits) {
        const item = document.createElement("li");
        item.className = "search-hit";
        const title = document.createElement("strong");
        title.textContent = hit.titulo;
        const subtitle = document.createElement("span");
        subtitle.textContent = hit.subtitulo || "";
        item.append(title, subtitle);
        item.addEventListener("click", () => onSelect?.(hit));
        list.append(item);
      }
      section.append(list);
      results.append(section);
    }
  }

  async function runSearch(q) {
    const thisRequest = ++requestId;
    if (!q) {
      status.textContent = "";
      results.innerHTML = "";
      return;
    }
    status.textContent = "Buscando...";
    const hits = await searchRepo.search(q);
    // A slower earlier request resolving after a newer one would otherwise
    // clobber the freshest results with stale ones -- discard anything but
    // the most recently issued request.
    if (thisRequest !== requestId) return;
    status.textContent = "";
    renderGroups(groupSearchHits(hits));
  }

  input.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const q = input.value.trim();
    debounceTimer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
  });

  return form;
}
