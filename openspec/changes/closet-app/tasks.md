# Tasks: Core Catalog CRUD (Prendas, Outfits, Tips) — closet-app

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2400–3000 (5 migrations ~250, `src/data/` ~350, `src/domain/` ~150, UI screens+components ~700, PWA shell ~100, unit tests ~500, `tests/rls/` ~450) |
| 400-line budget risk | High |
| Session review budget (collected) | 800 lines |
| vs 800-line budget | Still High — total exceeds 800 even under the raised budget |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — user decision required |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migrations (schema→RLS→views/search) + `src/data/` + `src/domain/`, no UI | PR 1 | `npx vitest run tests/unit/data tests/unit/domain` | `supabase start` + `supabase db reset` against local stack | Revert 5 migration files + `src/data/` + `src/domain/`; no UI depends on it yet |
| 2 | Auth/session gate + garment CRUD + reverse-lookup wiring stub | PR 2 | `npx vitest run tests/unit/ui` | Manual: sign in, CRUD a garment | Revert `src/ui/screens/login.js`, `session-gate.js`, `prendas-*.js` |
| 3 | Outfit CRUD/linking + Tips CRUD/dual-attach | PR 3 | `npx vitest run tests/unit/ui` | Manual: link/unlink garment, attach tip to both | Revert `outfit-*.js`, `tips-*.js`, `tip-form.js` |
| 4 | Unified search + reverse-lookup displays + PWA shell | PR 4 | `npx vitest run tests/unit/ui` | `sw.js` offline reload check in devtools | Revert `search.js`, lookup sections, `manifest.json`, `sw.js` |
| 5 | Full RLS integration suite (`tests/rls/`) | PR 5 | `SUPABASE_URL=... npx vitest run tests/rls` | Local Supabase stack (`supabase start`), two anon-key clients | Revert `tests/rls/` only; no production code changes |

## Phase 1: Test Infrastructure

- [x] 1.1 Scaffold `package.json` + `vitest.config.js` with two projects: `unit` (`tests/unit`, no network) and `rls` (`tests/rls`, skipped when `SUPABASE_URL` unset)

## Phase 2: Database Migrations

- [x] 2.1 `supabase/migrations/0001_types_and_lookups.sql` — enums, `colores` (+seed), `tipo_prenda` (+seed), paired `down`
- [x] 2.2 `0002_entities.sql` — `prenda`/`outfit`/`tip`, `disponible` generated column, `unique(id,user_id)`, indexes
- [x] 2.3 `0003_joins.sql` — `outfit_prenda`/`prenda_tip`/`outfit_tip` with composite FKs
- [x] 2.4 RED `tests/rls/pre-rls-anon-leak.test.js` — anon client SELECTs `prenda`/`outfit`/`tip` post-0003 and receives rows (fails: expects 0, gets data) — proves RLS not yet enforced (skipped if `SUPABASE_URL` unset)
- [x] 2.5 GREEN `0004_rls.sql` — enable RLS on all 8 tables; `owner_all FOR ALL` policy on 6 owned tables; `read_catalog`+`add_tipo` on lookups; turns 2.4 green
- [x] 2.6 `0005_views_and_search.sql` — `outfit_v` (`security_invoker=on`), `search_all(q)` RPC (`security invoker`)

## Phase 3: Data-Access Layer (`src/data/`, mocked-client unit tests)

- [x] 3.1 RED `tests/unit/data/prendas.test.js` — fake chainable client asserts `.from('prenda')...` call shapes for list/getById/create/update/remove
- [x] 3.2 GREEN `src/data/supabaseClient.js` + `src/data/prendas.js` (`makePrendasRepo`)
- [x] 3.3 RED+GREEN `tests/unit/data/outfits.test.js` + `src/data/outfits.js`
- [x] 3.4 RED+GREEN `tests/unit/data/tips.test.js` + `src/data/tips.js`
- [x] 3.5 RED+GREEN `tests/unit/data/links.test.js` + `src/data/links.js` (link/unlink×3 pairs)
- [x] 3.6 RED+GREEN `tests/unit/data/search.test.js` + `src/data/search.js` (`rpc('search_all',{q})` shape)
- [x] 3.7 RED+GREEN `tests/unit/data/auth.test.js` + `src/data/auth.js` (signIn/signOut/getSession/onAuthStateChange)
- [x] 3.8 RED+GREEN `tests/unit/data/catalogos.test.js` + `src/data/catalogos.js` (colores/tipo_prenda lookups)

## Phase 4: Domain Layer (`src/domain/`)

- [x] 4.1 RED+GREEN `tests/unit/domain/validation.test.js` + `src/domain/validation.js` (1–3 colores, required fields, `cantidad>0`, `precio>=0`, damage-flag requires `tipo_dano`)
- [x] 4.2 RED+GREEN `tests/unit/domain/mappers.test.js` + `src/domain/mappers.js` (row→view-model, `color[]`→`{nombre,hex}`, flatten `tipo_prenda`)
- [x] 4.3 RED+GREEN `tests/unit/domain/format.test.js` + `src/domain/format.js` (currency/date/list-join)

## Phase 5: Auth / Session UI

- [x] 5.1 RED+GREEN `tests/unit/ui/session-gate.test.js` + `src/ui/session-gate.js` (no session → redirect login)
- [x] 5.2 `src/ui/screens/login.js` (email/password) + `src/app.js` boot wiring

## Phase 6: Garment CRUD UI

- [x] 6.1 RED+GREEN `tests/unit/ui/prenda-form.test.js` — reject 4th color, reject damage flag without `tipo_dano`
- [x] 6.2 `src/ui/screens/prendas-list.js`, `prenda-detail.js`, `prenda-form.js` (create/edit/delete)
- [x] 6.3 (fix pass, post-verify) RED+GREEN `tests/unit/ui/prenda-form.test.js` DOM tests + `src/ui/screens/prenda-form.js` — mount `talla`/`temporada`/`estado`/`favorito` inputs and add them to `readPrendaFormValues`, closing verify-report-pr2.md CRITICAL-1 (silent data loss on edit) and CRITICAL-2 (unsettable spec-required fields)
- [x] 6.4 (fix pass #2, post-re-verify) RED+GREEN `tests/unit/ui/prenda-form.test.js` DOM tests + `src/ui/screens/prenda-form.js` — mount `detalle_dano` input in the damage fieldset, pre-fill on edit, refresh stale "untested"/"no branching" comments, closing verify-report-pr2.md CRITICAL-1-residual (silent data loss of `detalle_dano` on edit)

## Phase 6.5: Router & Entry Point (PR2.5 — closes verify-report-pr2.md CRITICAL-3)

Neither PR1 nor PR2 ever created `ui/router.js` or an HTML entry point, so the app could not actually load in a browser despite passing tests — flagged CRITICAL across three independent verify passes on PR2. This phase closes that planning gap without adding any new screens/features. `ui/transitions.js` + GSAP transitions (also listed in design.md's target file tree) remain deliberately out of scope here; they land with the visual-design change.

- [x] 6.5.1 RED+GREEN `tests/unit/ui/router.test.js` + `src/ui/router.js` — hash-based router: pure `parseHash`/`compileRoute`/`matchRoute` (path matching, `:param` extraction, route-order precedence) plus `createRouter()` DOM/window wiring (`start`/`navigate`/`reset`/`setGuard`/`redirectToLogin`/`allow`), window injectable for tests
- [x] 6.5.2 `src/main.js` — real browser entry point: builds the Supabase client + `prendasRepo`/`catalogosRepo`, registers `/prendas`, `/prendas/new`, `/prendas/:id`, `/prendas/:id/edit` routes against the existing screens, wires `session-gate`'s `guard` into the router via `router.setGuard`, calls `createApp(...).boot()`. `src/app.js` extended with an optional `client` param so main.js and `createApp` share one Supabase client instance.
- [x] 6.5.3 `public/index.html` — HTML shell (`#app` mount container, loads `src/main.js` as an ES module + a gitignored `public/config.js` for runtime Supabase config, template at `public/config.example.js`) — deliberately unstyled, no `app.css` exists yet
- [x] 6.5.4 `package.json` `dev` script + `scripts/dev-server.mjs` — zero-dependency static file server for local manual verification (no bundler introduced); serves `/src/*` from the repo's `src/` and everything else from `public/`, mirroring the production doc-root layout from design.md's target file tree

## Phase 7: Outfit CRUD UI + Linking (PR3)

- [x] 7.1 RED+GREEN `tests/unit/ui/outfit-link.test.js` — link/unlink triggers `outfit_v` refetch, no client-side recompute
- [x] 7.2 `src/ui/screens/outfits-list.js`, `outfit-detail.js`, `outfit-form.js` (CRUD, link/unlink, render `estado`/`nombre_sugerido`)
  - Additive, not a listed subtask but required to implement 7.1/7.2: `src/data/outfits.js` gained `getWithPrendas(id)` (RED+GREEN in `tests/unit/data/outfits.test.js`) alongside the existing `getById()` (left byte-identical) — `outfit_v` has no linked-garment ids, only a count, so the detail/unlink UI needs a second query. `src/domain/validation.js` gained `validateOutfit`/`validateTip` (RED+GREEN in `tests/unit/domain/validation.test.js`), matching the design-intended "validation.js mirrors DB constraints" role already established for `validatePrenda`.

## Phase 8: Tips CRUD UI + Dual Attachment (PR3)

- [x] 8.1 RED+GREEN `tests/unit/ui/tip-attach.test.js` — detach from one relation leaves the other intact
- [x] 8.2 `src/ui/screens/tips-list.js`, `tip-form.js` (CRUD, attach/detach outfit+garment independently)
  - No separate `tip-detail.js` exists (per this task list) — `tip-form.js` in edit mode doubles as the attachment-management view and also carries the delete button (styling-tips "Delete a tip"), same cascade-FK reasoning as `prenda-detail.js`/`outfit-detail.js`.
  - `src/main.js` wired with `/outfits`, `/outfits/new`, `/outfits/:id`, `/outfits/:id/edit`, `/tips`, `/tips/new`, `/tips/:id` routes against the new screens, following the same route-ordering convention (static/longer patterns before `:id`) established in Phase 6.5.

## Phase 9: Unified Search (PR4)

- [x] 9.1 RED+GREEN `tests/unit/ui/search.test.js` — groups `SearchHit[]` by `tipo`; empty groups on no match
- [x] 9.2 `src/ui/screens/search.js` wired to `data/search.js` — mounted as its own `/search` route in `src/main.js` (no persistent nav bar exists anywhere in the app yet, see Phase 6.5/PR3 notes; consistent with the existing hash-navigation convention rather than introducing new UI chrome)

## Phase 10: Reverse-Lookup Displays (PR4)

- [x] 10.1 `src/ui/screens/prenda-detail.js` — add linked-outfits + linked-tips sections, empty-state when none. `src/ui/screens/outfit-detail.js` also gained a linked-tips section (styling-tips "each entity's detail view MUST show the tip" — closes verify-report-pr3.md's WARNING-2/CRITICAL flag that outfit-detail.js rendered no tip list at all). Additive, not a listed subtask but required: `src/data/outfits.js` gained `getLinkedTipIds(id)` (RED+GREEN in `tests/unit/data/outfits.test.js`) so outfit-detail.js can resolve its own linked tip ids, mirroring `prendasRepo.getById()`'s existing `{ prenda, outfits, tips }` shape (design.md Interfaces/Contracts, built in PR2) that already supplies prenda-detail.js's reverse-lookup ids without any new method.
- [x] 10.2 `src/ui/components/empty-state.js` reused for both lookup sections on `prenda-detail.js` (existing empty-state `<li>`s elsewhere predate this component and were left as-is, matching the "don't touch what Phase 10 doesn't own" convention)

## Phase 11: PWA Shell (PR4)

- [x] 11.1 RED+GREEN `tests/unit/sw-routing.test.js` + `public/sw.js` — pure `shouldHandle(request, origin)`; cross-origin (incl. `*.supabase.co` and the local `127.0.0.1:56321` dev stack) returns `false`
- [x] 11.2 `public/manifest.json` (icons 192/512/maskable placeholder PNGs under `public/icons/`, `standalone`) + `sw.js` install/activate/fetch wired to `shouldHandle`, registered from `src/main.js` as `{ type: "module" }`

## Phase 12: RLS Integration Test Suite (`tests/rls/`, requires `SUPABASE_URL`)

- [ ] 12.1 `tests/rls/setup.js` — two clients from the same anon key: one anonymous, one `signInWithPassword`; fail loudly (not silently skip) if `SUPABASE_URL` is set but connection fails
- [ ] 12.2 `tests/rls/owned-tables.test.js` — for `prenda`/`outfit`/`tip`/`outfit_prenda`/`prenda_tip`/`outfit_tip`: anon SELECT=0 rows, anon INSERT/UPDATE/DELETE fails or affects 0 rows; authenticated owner succeeds on own rows
- [ ] 12.3 `tests/rls/lookup-tables.test.js` — `colores`/`tipo_prenda`: authenticated SELECT works, anon SELECT=0; `tipo_prenda` authenticated INSERT allowed, UPDATE/DELETE denied
- [ ] 12.4 `tests/rls/security-invoker-footguns.test.js` — anon query of `outfit_v` returns 0 rows; anon `rpc('search_all')` returns 0 rows
- [ ] 12.5 `tests/rls/composite-fk-guard.test.js` — seed a second test user; attempt cross-owner links via all 3 join tables; assert FK rejects
- [ ] 12.6 `tests/rls/derived-values.test.js` — `outfit_v.estado` for 0/all-`En closet`/mixed garments; `nombre_sugerido` distinct+`orden`-ordered; direct `UPDATE prenda SET disponible=...` rejected
- [ ] 12.7 Note in `.env.local.example` comment: CI MUST set `SUPABASE_URL` or this suite silently skips — run `SUPABASE_URL=... npx vitest run tests/rls` locally before merge

## Key Learnings

1. Design flags the RLS suite as easy to silently skip in CI without `SUPABASE_URL`, so task 12.7 makes the fail-open risk an explicit checklist item rather than an assumption.
2. The design's TDD trick — writing the anon-zero-access RED test before enabling RLS (task 2.4) so the security posture itself is test-driven — was preserved inside the migrations phase even though the user's requested ordering placed the comprehensive `tests/rls/` suite last.
3. Estimated total changed lines (~2400–3000) exceed both the generic 400-line default and the session's raised 800-line budget, so chained PRs are recommended regardless of which budget applies.
4. `security_invoker = on` is required on `outfit_v` and explicit on `search_all()` because the Postgres default (definer-style view execution) would silently bypass RLS — task 12.4 exists specifically to prove that footgun stays closed.
5. Reverse-lookup UI for garments is deliberately split from garment CRUD (phase 6) into its own phase 10, matching the user's explicit build-order instruction even though both touch `prenda-detail.js`.
