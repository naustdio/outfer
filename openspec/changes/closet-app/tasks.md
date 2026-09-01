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

## Phase 7: Outfit CRUD UI + Linking

- [ ] 7.1 RED+GREEN `tests/unit/ui/outfit-link.test.js` — link/unlink triggers `outfit_v` refetch, no client-side recompute
- [ ] 7.2 `src/ui/screens/outfits-list.js`, `outfit-detail.js`, `outfit-form.js` (CRUD, link/unlink, render `estado`/`nombre_sugerido`)

## Phase 8: Tips CRUD UI + Dual Attachment

- [ ] 8.1 RED+GREEN `tests/unit/ui/tip-attach.test.js` — detach from one relation leaves the other intact
- [ ] 8.2 `src/ui/screens/tips-list.js`, `tip-form.js` (CRUD, attach/detach outfit+garment independently)

## Phase 9: Unified Search

- [ ] 9.1 RED+GREEN `tests/unit/ui/search.test.js` — groups `SearchHit[]` by `tipo`; empty groups on no match
- [ ] 9.2 `src/ui/screens/search.js` wired to `data/search.js`

## Phase 10: Reverse-Lookup Displays

- [ ] 10.1 `src/ui/screens/prenda-detail.js` — add linked-outfits + linked-tips sections, empty-state when none
- [ ] 10.2 `src/ui/components/empty-state.js` reused for both lookup sections

## Phase 11: PWA Shell

- [ ] 11.1 RED+GREEN `tests/unit/sw-routing.test.js` + `public/sw.js` — pure `shouldHandle(request)`; `*.supabase.co` returns `false`
- [ ] 11.2 `public/manifest.json` (icons 192/512/maskable, `standalone`) + `sw.js` install/activate/fetch wired to `shouldHandle`

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
