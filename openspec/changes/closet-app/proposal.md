# Proposal: Core Catalog CRUD (Prendas, Outfits, Tips)

## Intent

The wardrobe lives in a Notion prototype that cannot express its real domain: outfit completeness must be re-checked by hand, garment↔outfit↔tip relations are unqueryable in reverse, and nothing is searchable across types. This change delivers the first working vertical slice — a single-owner PWA over a real relational schema — so the catalog becomes trustworthy before any AI feature is layered on it.

## Scope

### In Scope

- Supabase Postgres schema: `prenda`, `outfit`, `tip`, plus three M:N join tables (prenda↔outfit, prenda↔tip, outfit↔tip).
- Derived values, never hand-set: `prenda.disponible` (from `estado`), `outfit.estado` (Disponible / Incompleto / Sin prendas), `outfit.nombre_sugerido` (from distinct `tipo_prenda` of linked garments).
- Full CRUD for all three entities and their links, via the Supabase JS SDK called directly from the frontend (no Node backend in this change).
- Screens: garment list + detail (reverse "outfits using this garment" + related tips), outfit list + detail (linked garments, computed `estado`, `imagen_inspiracion`), tips list, and create/edit forms per entity.
- Unified search across Prendas + Outfits + Tips, results grouped by type.
- Single-owner access via real Supabase Auth (email/password). Every table carries a `user_id` (or equivalent ownership column) and RLS policies scoped to `auth.uid()` — one real user today, no schema rework needed if a second user is ever added.
- PWA shell: `manifest.json` + service worker caching the app shell only.
- Vanilla JS + GSAP; Vitest scaffolded as the first task (strict TDD).

### Out of Scope

- AI outfit-breakdown pipeline (upload, vision detection, draft garments, hero generation, hotspots) — separate change, gated on a hotspot-coordinate spike.
- Offline data caching / IndexedDB for garment data.
- Express vs Fastify: no backend surface exists in this change; the decision defers with the AI pipeline.
- Visual/design system (beige hero, gray/black, typography) — a later design-phase input.

## Capabilities

### New Capabilities

- `garment-catalog`: Prenda fields, lifecycle, derived `disponible`, damage/season attributes, CRUD.
- `outfit-composition`: Outfit CRUD, garment links, derived `estado` and `nombre_sugerido`.
- `styling-tips`: Tip CRUD and dual attachment to both Outfits and Prendas.
- `unified-search`: cross-entity search returning results grouped by type.
- `owner-access`: single-owner Supabase Auth (email/password) + RLS policies scoped to `auth.uid()` on every table, gating all catalog operations.
- `pwa-shell`: installable manifest and app-shell service worker.

### Modified Capabilities

- None (greenfield; `openspec/specs/` is empty).

## Approach

Frontend-direct-to-Supabase, no server tier. Schema-first: SQL migrations define tables, the fixed `colores` catalog, and `tipo_prenda` as a lookup table (not an enum) so vocabulary grows without migrations. Every table carries an ownership column and RLS policies scoped to `auth.uid()`; the frontend authenticates via Supabase Auth (email/password) before any catalog screen is reachable, so the public anon key alone can no longer read or write data. Derived values are Postgres **views** over the base tables — always correct, zero write-path drift, adequate at personal scale; a stored/trigger column is the documented escalation if filtering performance ever demands it. A thin data-access module wraps the Supabase SDK so query logic is unit-testable under Vitest with a mocked client, keeping DOM/GSAP rendering separate from data rules. Unified search is one Postgres function or per-table `ilike` queries merged client-side and grouped by type, and — like every other query — runs under RLS so it can never return another user's rows.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Tables, join tables, lookup tables, derived views, RLS policies |
| `src/data/` | New | Supabase SDK wrapper, per-entity queries, search |
| `src/domain/` | New | Derivation rules (estado, disponible, nombre_sugerido) |
| `src/ui/` | New | List/detail/form screens, GSAP transitions |
| `public/manifest.json`, `public/sw.js` | New | PWA shell |
| `package.json`, `vitest.config.js` | New | Test runner scaffold (first task) |
| `openspec/specs/` | New | Six capability specs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RLS policy bugs could over- or under-restrict access (e.g. a missing policy leaves a table wide open, or a wrong one locks the owner out of their own data) | Medium | Test RLS with both an authenticated and an anonymous Supabase client per table before marking a migration done; deny-by-default (RLS enabled with no policy = no access) as the starting posture |
| Views not filterable/indexable like columns as the catalog grows | Low | Personal-scale data; escalate to a trigger-maintained column only if measured |
| Deferred AI pipeline forces schema change later (draft garment status) | Medium | Add the draft-status axis in the later change; the M:N core is unaffected |
| No test runner exists; strict TDD blocks all work | High | Vitest scaffold is task 1.1, before any RED test |
| Vanilla JS state management sprawls across six screens | Medium | Enforce data/domain/ui separation from the first screen |

## Rollback Plan

Greenfield, so rollback is cheap: revert the feature branch to drop all frontend code. Database changes roll back via a paired `down` migration per migration file dropping views, join tables, then base tables — no production data exists to preserve at this stage. Supabase Storage buckets created for photos are deleted manually if the change is abandoned.

## Dependencies

- **Supabase** (Postgres + Storage + Auth) — project provisioned, anon key issued, email/password Auth enabled and RLS active on every table from this change onward.
- **Hostinger** static hosting for the PWA; the single Node slot stays unused here.
- **GSAP** and **Vitest** as npm dependencies; no framework.
- OpenRouter/Gemini: not a dependency of this change.

## Success Criteria

- [ ] All three entities can be created, read, updated, and deleted from the UI, including linking/unlinking across all three M:N relations.
- [ ] `outfit.estado` and `nombre_sugerido` are never writable and always reflect current garment links; `prenda.disponible` follows `estado`.
- [ ] A garment detail page lists every outfit using it and every tip attached to it.
- [ ] One search query returns matching Prendas, Outfits, and Tips grouped by type.
- [ ] The app installs as a PWA and its shell loads with the network offline.
- [ ] Catalog operations are unreachable without a valid Supabase Auth session; an unauthenticated Supabase client (i.e. holding only the public anon key) can read or write zero rows on any table.
- [ ] `npx vitest run` passes with tests written before implementation for every domain rule.
