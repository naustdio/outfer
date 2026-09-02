// Real browser entry point. Loaded by public/index.html as a <script
// type="module">. Builds the concrete Supabase client + repos, the concrete
// router (src/ui/router.js), wires router routes to the garment screens
// that already exist (src/ui/screens/*), and boots src/app.js.
//
// Added in Phase 6.5 to close verify-report-pr2's CRITICAL-3: no prior task
// created a router or HTML entry point, so the app -- despite having
// working screens and a passing 70/70 test suite -- could not actually be
// loaded or navigated in a browser.
//
// Not unit tested: this is pure DOM/window wiring, same convention as the
// screens it wires together (see prendas-list.js, prenda-detail.js,
// login.js headers) -- the testable logic lives in src/ui/router.js
// (tests/unit/ui/router.test.js) and the repos/domain modules it composes.
import { createApp } from "./app.js";
import { createRouter } from "./ui/router.js";
import { createSupabaseClient } from "./data/supabaseClient.js";
import { makePrendasRepo } from "./data/prendas.js";
import { makeOutfitsRepo } from "./data/outfits.js";
import { makeTipsRepo } from "./data/tips.js";
import { makeLinksRepo } from "./data/links.js";
import { makeCatalogosRepo } from "./data/catalogos.js";
import { renderPrendasList } from "./ui/screens/prendas-list.js";
import { renderPrendaDetail } from "./ui/screens/prenda-detail.js";
import { renderPrendaForm } from "./ui/screens/prenda-form.js";
import { renderOutfitsList } from "./ui/screens/outfits-list.js";
import { renderOutfitDetail } from "./ui/screens/outfit-detail.js";
import { renderOutfitForm } from "./ui/screens/outfit-form.js";
import { renderTipsList } from "./ui/screens/tips-list.js";
import { renderTipForm } from "./ui/screens/tip-form.js";
import { renderSearch } from "./ui/screens/search.js";
import { makeSearchRepo } from "./data/search.js";

// Runtime config comes from a plain global set by public/config.js (see
// public/config.example.js), not a bundler env var -- design.md: vanilla ES
// modules, no build step. Safe to ship as a static file: the Supabase anon
// key is public by design (design.md "the anon key is public in a static
// PWA -- a client-side gate protects nothing"; RLS is the real boundary).
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__CLOSET_APP_CONFIG__ ?? {};

const root = document.getElementById("app");
const client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const prendasRepo = makePrendasRepo(client);
const outfitsRepo = makeOutfitsRepo(client);
const tipsRepo = makeTipsRepo(client);
const linksRepo = makeLinksRepo(client);
const catalogosRepo = makeCatalogosRepo(client);
const searchRepo = makeSearchRepo(client);

async function loadFormCatalogs() {
  const [coloresCatalog, tiposPrendaCatalog] = await Promise.all([
    catalogosRepo.listColores(),
    catalogosRepo.listTiposPrenda(),
  ]);
  return { coloresCatalog, tiposPrendaCatalog };
}

// `nav` is a stable object whose `navigate` forwards to whatever `router`
// ends up being -- lets route handlers close over navigation before the
// router itself exists (createRouter needs the fully-built `routes` array
// up front, but those routes need to call router.navigate()).
const nav = { navigate: (path) => router.navigate(path) };

// Order matters (src/ui/router.js matchRoute): more specific/static
// patterns must precede the general "/prendas/:id".
const routes = [
  {
    pattern: "/prendas/new",
    handler: async (container) => {
      const catalogs = await loadFormCatalogs();
      renderPrendaForm(container, {
        ...catalogs,
        prendasRepo,
        onSaved: () => nav.navigate("/prendas"),
        onCancel: () => nav.navigate("/prendas"),
      });
    },
  },
  {
    pattern: "/prendas/:id/edit",
    handler: async (container, { id }) => {
      const [{ prenda }, catalogs] = await Promise.all([prendasRepo.getById(id), loadFormCatalogs()]);
      renderPrendaForm(container, {
        prenda,
        ...catalogs,
        prendasRepo,
        onSaved: () => nav.navigate(`/prendas/${id}`),
        onCancel: () => nav.navigate(`/prendas/${id}`),
      });
    },
  },
  {
    pattern: "/prendas/:id",
    handler: (container, { id }) =>
      renderPrendaDetail(container, id, {
        prendasRepo,
        catalogosRepo,
        outfitsRepo,
        tipsRepo,
        onEdit: (editId) => nav.navigate(`/prendas/${editId}/edit`),
        onDelete: () => nav.navigate("/prendas"),
        onSelectOutfit: (outfitId) => nav.navigate(`/outfits/${outfitId}`),
        onSelectTip: (tipId) => nav.navigate(`/tips/${tipId}`),
      }),
  },
  {
    pattern: "/prendas",
    handler: (container) =>
      renderPrendasList(container, {
        prendasRepo,
        catalogosRepo,
        onSelect: (id) => nav.navigate(`/prendas/${id}`),
        onCreate: () => nav.navigate("/prendas/new"),
      }),
  },
  {
    pattern: "/outfits/new",
    handler: (container) =>
      renderOutfitForm(container, {
        outfitsRepo,
        onSaved: (saved) => nav.navigate(`/outfits/${saved.id}`),
        onCancel: () => nav.navigate("/outfits"),
      }),
  },
  {
    pattern: "/outfits/:id/edit",
    handler: async (container, { id }) => {
      const { outfit } = await outfitsRepo.getWithPrendas(id);
      renderOutfitForm(container, {
        outfit,
        outfitsRepo,
        onSaved: () => nav.navigate(`/outfits/${id}`),
        onCancel: () => nav.navigate(`/outfits/${id}`),
      });
    },
  },
  {
    pattern: "/outfits/:id",
    handler: (container, { id }) =>
      renderOutfitDetail(container, id, {
        outfitsRepo,
        prendasRepo,
        tipsRepo,
        linksRepo,
        catalogosRepo,
        onEdit: (editId) => nav.navigate(`/outfits/${editId}/edit`),
        onDelete: () => nav.navigate("/outfits"),
        onSelectTip: (tipId) => nav.navigate(`/tips/${tipId}`),
      }),
  },
  {
    pattern: "/outfits",
    handler: (container) =>
      renderOutfitsList(container, {
        outfitsRepo,
        onSelect: (id) => nav.navigate(`/outfits/${id}`),
        onCreate: () => nav.navigate("/outfits/new"),
      }),
  },
  {
    pattern: "/tips/new",
    handler: (container) =>
      renderTipForm(container, {
        tipsRepo,
        linksRepo,
        onSaved: (saved) => nav.navigate(`/tips/${saved.id}`),
        onCancel: () => nav.navigate("/tips"),
      }),
  },
  {
    // Combined edit + dual-attachment view -- there is no separate
    // tip-detail.js (tasks.md Phase 8 lists only tips-list.js + tip-form.js).
    pattern: "/tips/:id",
    handler: async (container, { id }) => {
      const [{ tip, outfits, prendas }, allOutfits, allPrendas] = await Promise.all([
        tipsRepo.getById(id),
        outfitsRepo.list(),
        prendasRepo.list(),
      ]);
      renderTipForm(container, {
        tip,
        attachedOutfits: outfits,
        attachedPrendas: prendas,
        allOutfits,
        allPrendas,
        tipsRepo,
        linksRepo,
        onSaved: () => nav.navigate(`/tips/${id}`),
        onCancel: () => nav.navigate("/tips"),
        onDeleted: () => nav.navigate("/tips"),
      });
    },
  },
  {
    pattern: "/tips",
    handler: (container) =>
      renderTipsList(container, {
        tipsRepo,
        onSelect: (id) => nav.navigate(`/tips/${id}`),
        onCreate: () => nav.navigate("/tips/new"),
      }),
  },
  {
    // unified-search "Cross-Entity Search". No persistent nav bar exists
    // anywhere in the app yet (see search.js's header comment), so this is
    // reached the same way every other screen is: the hash bar (e.g.
    // `#/search`).
    pattern: "/search",
    handler: (container) =>
      renderSearch(container, {
        searchRepo,
        onSelect: (hit) => {
          if (hit.tipo === "prenda") nav.navigate(`/prendas/${hit.id}`);
          else if (hit.tipo === "outfit") nav.navigate(`/outfits/${hit.id}`);
          else if (hit.tipo === "tip") nav.navigate(`/tips/${hit.id}`);
        },
      }),
  },
];

function notFound(container, path) {
  container.innerHTML = "";
  const message = document.createElement("p");
  message.textContent = `Ruta no encontrada: ${path}`;
  container.append(message);
}

const router = createRouter({ root, routes, notFound });
const app = createApp({ client, root, router });
router.setGuard((path) => app.gate.guard(path));

app.boot();

// pwa-shell "Installability": registering the service worker (alongside
// public/manifest.json's <link> in index.html) is what makes a supporting
// browser's installability criteria met. Registered as a module (matches
// public/sw.js being an ES module -- it exports shouldHandle for
// tests/unit/sw-routing.test.js) and guarded by feature detection, since
// not every browser supports service workers and a boot-time throw here
// must never block the rest of the app from loading.
if ("serviceWorker" in navigator) {
  // Registration failure must never block boot (see comment above), but
  // swallowing it silently made a real failure mode invisible: verify-report-
  // pr4 WARNING-2 found that one missing precache URL used to reject the
  // whole install with nothing surfaced anywhere. Log it instead.
  navigator.serviceWorker
    .register("/sw.js", { type: "module" })
    .catch((error) => console.warn("[sw] registration failed:", error));
}
