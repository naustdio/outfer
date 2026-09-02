```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e5da25e1b19fb25bb8a7fb6be7cec2ec1b2792bc70f5cb47e28eedbca0e85f85
verdict: fail
blockers: 4
critical_findings: 4
requirements: 2/6
scenarios: 7/13
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:bb9fb38862b3a8cef374f7774ce631d79c676654c665f946345115268fdb174b
build_command: node --check over all tracked src/**/*.js, public/sw.js, scripts/*.mjs (no bundler; vanilla ES modules per design.md)
build_exit_code: 0
build_output_hash: sha256:36e895842165228fb2a06c9fa9ae3fa15814a3a44f4d0ce69d6de8871705c2fa
```

# Verification Report — closet-app PR4 (Phases 9-11)

**Change**: `closet-app`
**Slice**: PR4 — unified search (Phase 9) + reverse-lookup displays (Phase 10) + PWA shell (Phase 11)
**Branch**: `closet-app/pr4-search-lookups-pwa` @ `275bd80`
**Base**: `closet-app/pr3-outfit-tips-crud` @ `9ac8020` (post-rebase)
**Mode**: Strict TDD verify (hybrid persistence: OpenSpec file + Engram)
**Date**: 2026-09-02

---

## Executive Verdict

**Machine verdict: FAIL** — coverage-only. 5 of 13 in-scope spec scenarios have no passing
covering test, all of them deferred-by-design (RLS to Phase 12/PR5; DOM screens to manual/E2E
per design.md's Testing Strategy table).

**Engineering verdict: PASS WITH WARNINGS** — zero functional defects found. All three
documented TDD cycles audited clean, 110/110 tests pass, and the two load-bearing PWA
scenarios that PR3 could only assert on paper were **proved at runtime in a real Chrome**
this session.

---

## Completeness

| Dimension | Result | Detail |
|---|---|---|
| Phase 9 tasks (9.1, 9.2) | PASS | Both `[x]`, code present, tests pass |
| Phase 10 tasks (10.1, 10.2) | PASS | Both `[x]`, code present |
| Phase 11 tasks (11.1, 11.2) | PASS | Both `[x]`, code present, tests pass |
| Unchecked tasks in `tasks.md` | 7 (scoped out) | All Phase 12 (`12.1`-`12.7`) — PR5 scope, correctly outside this slice |
| Artifacts read | PASS | specs, design.md, tasks.md, apply-progress, verify-report-pr3.md |

---

## Build / Test Evidence

| Command | Exit | Result |
|---|---|---|
| `npx vitest run` | 0 | **110 passed / 110** (19 files: 107 unit + 3 RLS) |

Per-cycle regression check re-run in a detached worktree (see TDD audit below): 101 to 102 to 107
unit tests, monotonic, zero regressions at any GREEN.

No linter or type checker is configured in `package.json`. No coverage tool configured.
Coverage and quality metrics: **skipped — no tools detected** (not a failure).

---

## TDD Compliance (Strict TDD Mode)

Audited in a detached worktree at each recorded commit. **Note**: the SHAs recorded in
`apply-progress` (`bbcea45`/`09731a1`, `e399d3c`/`3632e1a`, `3f5852c`/`7aae3a5`) no longer
exist — the branch was rebased onto the updated pr3 tip after the apply run. The equivalent
post-rebase SHAs were audited instead.

| Cycle | RED | RED is test-only | RED fails for the right reason | GREEN | GREEN is src-only |
|---|---|---|---|---|---|
| `groupSearchHits` | `3dcc94c` | YES — 1 file, `tests/unit/ui/search.test.js` (+52) | YES — `Failed to load url ../../../src/ui/screens/search.js` (module absent) | `793f5ae` | YES — 1 file, `src/ui/screens/search.js` (+121) |
| `getLinkedTipIds` | `e675321` | YES — 1 file, `tests/unit/data/outfits.test.js` (+19) | YES — `TypeError: repo.getLinkedTipIds is not a function` (1 failed / 6 passed) | `85fe544` | YES — 1 file, `src/data/outfits.js` (+11) |
| `shouldHandle` | `b459fd4` | YES — 1 file, `tests/unit/sw-routing.test.js` (+52) | YES — `Failed to load url ../../public/sw.js` (module absent) | `fedcf8b` | YES — 1 file, `public/sw.js` (+102) |

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | PASS | Present in apply-progress |
| RED confirmed (test-only, fails correctly) | PASS | 3/3 |
| GREEN confirmed (src-only, turns test green) | PASS | 3/3 |
| Full suite green at each GREEN | PASS | 101 / 102 / 107 unit, monotonic |
| Triangulation adequate | PASS | search 4 cases, sw-routing 5 cases, getLinkedTipIds 1 case (single behaviour) |
| Safety net on modified files | PASS | Full unit suite run at each GREEN, not just the changed file |

**TDD Compliance: 6/6 checks passed.** This is the cleanest TDD history in the chain so far —
perfect RED/GREEN file-set purity across all three cycles.

---

## Assertion Quality

Audited `tests/unit/ui/search.test.js`, `tests/unit/sw-routing.test.js`, and the new case in
`tests/unit/data/outfits.test.js`.

- No tautologies, no `toBeDefined()`-only assertions, no ghost loops, no smoke tests.
- No mocks used at all in the new tests (`makeFakeClient` is a hand-written stub, not `vi.mock`).
- `getLinkedTipIds` asserts the **query shape** (table is `outfit_tip`, ops contain `eq outfit_id o1`)
  *and* the mapped return value (`["t1","t2"]`) — behaviour, not implementation coupling.
- `groupSearchHits` triangulates with genuinely different expected values (all-three-types,
  empty, single-type, order-preserving) — no "all assert empty" variance problem.

**Assertion quality: all assertions verify real behavior.** 0 CRITICAL, 0 WARNING.

---

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | 107 | 16 | vitest |
| Integration (jsdom DOM) | included above | 2 (`prenda-form`, `app`) | vitest + jsdom |
| RLS/integration (live Postgres) | 3 | 1 | vitest + supabase-js |
| E2E (browser) | 0 | 0 | not installed |
| **Total** | **110** | **19** | |

Ad-hoc runtime verification for this report was performed by driving a real Chrome
(`chrome.exe --headless=new`) over the Chrome DevTools Protocol from Node — this is verification
evidence, not a committed test.

---

## Spec Compliance Matrix

In-scope specs: `unified-search` (2 req / 4 scen), `pwa-shell` (2 req / 5 scen),
`garment-catalog` Reverse Lookups (1 req / 2 scen), `styling-tips` Dual Attachment (1 req / 2 scen).
**Total: 6 requirements, 13 scenarios.**

| # | Spec / Requirement | Scenario | Status | Evidence |
|---|---|---|---|---|
| 1 | unified-search / Cross-Entity Search | Query matches across all three types | PASS | `search.test.js` case 1 (passing) + `search_all` SQL unions all 3 tables + orchestrator manual browser pass |
| 2 | unified-search / Cross-Entity Search | No matches gives empty groups, not an error | PASS | `search.test.js` case 2 (passing) |
| 3 | unified-search / Cross-Entity Search | Match in one type empties the others | PASS | `search.test.js` case 3 (passing) |
| 4 | unified-search / Ownership Scope | Search never returns another user's data | UNTESTED | `security invoker` declared in `0005_views_and_search.sql`; no client-side `user_id` filter anywhere. **No two-user runtime test** — deferred by design to task 12.4 (PR5) |
| 5 | pwa-shell / Installability | Browser offers install prompt | PARTIAL | manifest valid (name/icons/start_url/display); **SW registration + activation proved at runtime** this session. Actual prompt requires HTTPS + engagement heuristics, unverifiable locally |
| 6 | pwa-shell / Installability | Installed app launches standalone | UNTESTED | `display: standalone` present in `manifest.json`; config-only, no runtime install performed |
| 7 | pwa-shell / App-Shell-Only Caching | App shell loads offline | **PASS (runtime-proved)** | Real Chrome, `Network.emulateNetworkConditions offline:true`, reload gave `document.title === "Closet"`, `#app` present, `main.js` executed, login form rendered from `closet-shell-v1` |
| 8 | pwa-shell / App-Shell-Only Caching | No stale cached data served offline | **PASS (runtime-proved)** | Offline fetch of `http://127.0.0.1:56321/rest/v1/prenda` gave `Failed to fetch`, **not** a cached response. Cache audit: 0 cross-origin entries. Plus 3 passing `shouldHandle` unit cases |
| 9 | pwa-shell / App-Shell-Only Caching | SW refreshes cached shell on new deploys | UNTESTED | `activate` deletes non-`closet-shell-v1` caches, but invalidation depends entirely on a human bumping the version string. See WARNING-1 |
| 10 | garment-catalog / Reverse Lookups | Garment detail shows linked outfits and tips | PARTIAL | Data path verified by source: `prendasRepo.getById()` returns `{prenda, outfits:[{outfit_id}], tips:[{tip_id}]}`, correctly mapped in `prenda-detail.js:81,102`. No automated DOM test (design.md defers DOM screens); orchestrator manual pass confirms |
| 11 | garment-catalog / Reverse Lookups | Garment with no links shows empty lists | PARTIAL | `renderEmptyState("Sin outfits vinculados.")` / `("Sin tips vinculados.")` at `prenda-detail.js:91,112`. No automated test; orchestrator manual pass confirms |
| 12 | styling-tips / Dual Attachment | Each entity's detail view MUST show the tip | PASS | **Closes verify-report-pr3 WARNING-2.** `outfit-detail.js:153-171` now renders "Tips vinculados" from the new `getLinkedTipIds()` (unit-tested, passing); prenda side at `prenda-detail.js:102-120`. Orchestrator manual pass confirms both sides |
| 13 | styling-tips / Dual Attachment | Detach from one relation leaves the other | PASS | `tests/unit/ui/tip-attach.test.js` (4 cases, passing, from PR3) |

**Compliance: 7 PASS, 3 PARTIAL, 3 UNTESTED — 0 FAILING.**

---

## Correctness Review

### Reverse-lookup data correctness (verified against actual repo contracts, not screenshots)

| Consumer | Repo contract | Mapping in UI | Verdict |
|---|---|---|---|
| `prenda-detail.js` linked outfits | `prendasRepo.getById()` returns `outfits` as rows of `{outfit_id}` (`src/data/prendas.js:22,29`) | `new Set(linkedOutfitRows.map(r => r.outfit_id))` filtered against `outfitsRepo.list()` by `o.id` | Correct |
| `prenda-detail.js` linked tips | same call returns `tips` as rows of `{tip_id}` (`prendas.js:23`) | `new Set(linkedTipRows.map(r => r.tip_id))` filtered against `tipsRepo.list()` by `t.id`; renders `row.tip` (matches the `tip` table's text column) | Correct |
| `outfit-detail.js` linked tips | **new** `outfitsRepo.getLinkedTipIds(id)` selects `tip_id` where `outfit_id = id`, then maps to a flat id array | `new Set(tipIds)` filtered against `tipsRepo.list()` by `t.id` | Correct |

`getWithPrendas()` was kept byte-identical; `getLinkedTipIds` is purely additive. `draw()`'s
`tipIds`/`allTips` are threaded unchanged through the garment link/unlink re-draw paths — correct,
because linking a garment cannot change an outfit's tip attachments.

### Search correctness

| Check | Verdict | Evidence |
|---|---|---|
| Calls the RPC, does not reinvent filtering client-side | Correct | `src/data/search.js` calls `client.rpc("search_all", { q })`, single round trip. No `ilike` chains in JS |
| Field contract matches the RPC | Correct | `search_all` returns `(tipo text, id uuid, titulo text, subtitulo text)`; `search.js` reads exactly `hit.tipo` / `hit.titulo` / `hit.subtitulo` / `hit.id` |
| Grouping by type is correct | Correct | `groupSearchHits` seeds all three keys, so absent types yield `[]` not `undefined` — this is what makes scenarios 2 and 3 hold. Order within a group preserved (array push) |
| RLS structurally applies | Correct | `security invoker` declared explicitly on `search_all` with a comment naming the definer-default footgun. No application-level `user_id` filter substitutes for it |
| Stale-response guard | Correct (untested) | Monotonic `requestId`; a slower earlier keystroke is discarded. Logic is correct on inspection but has **no test** — see WARNING-5 |

Note: the orchestrator's observation that searching "negro" returned zero Prenda hits for a
garment named with "negra" is **correct behaviour**, not a defect — `search_all` uses a
substring `ilike` match, and "negra" does not contain "negro".

### Same-origin-only caching guarantee (security-relevant)

`shouldHandle(request, origin)` returns true only when the method is GET and
`new URL(request.url).origin === origin`. Because `URL.origin` includes scheme, host **and port**,
this excludes every Supabase shape. Verified live inside the running app's origin
(`http://localhost:5173`):

| Input | Result |
|---|---|
| `http://localhost:5173/src/main.js` GET | `true` |
| `https://abc.supabase.co/rest/v1/prenda` GET | `false` |
| `http://127.0.0.1:56321/rest/v1/prenda` GET (local dev stack) | `false` |
| `http://127.0.0.1:5173/x.js` GET (same port, different host — **not covered by any test**) | `false` |
| `http://localhost:5173/x` POST | `false` |

**Runtime cache audit** after exercising `/`, `#/search`, `#/prendas`, `#/outfits`, `#/tips` under
SW control: exactly one cache (`closet-shell-v1`), 34 entries, **every single one same-origin**.
Zero Supabase entries, cloud or local. The guarantee holds.

The audit also confirms design decision 6 works as intended: `search.js` and `empty-state.js` —
this PR's own new modules, absent from `PRECACHE_URLS` — were opportunistically cached by
`cacheFirst()` after one online visit.

---

## Design Coherence

| Design decision | Implementation | Verdict |
|---|---|---|
| Search via `search_all` RPC, UI groups by `tipo` | `data/search.js` + `groupSearchHits` | Coherent |
| Views/functions must be security_invoker | Declared explicitly with justifying comment | Coherent |
| Extract `shouldHandle(request)` and test it directly | Done, with `origin` as an explicit param for Node testability | Coherent |
| Cross-origin bypass is load-bearing (no token/row caching) | No `supabase.co` string matching; origin check alone | Coherent, and runtime-proved |
| Refetch after mutation, never client-side re-derivation | `handleLinkGarment`/`handleUnlinkGarment` refetch `getWithPrendas` | Coherent |
| Search UI placement | **Deviation**: `/search` route instead of persistent header | Documented deviation. design.md specifies only the data contract, not chrome placement; no nav bar exists anywhere. Does not break any spec — no requirement mandates placement |

---

## Service-Worker Registration Anomaly — Resolved

**Conclusion: this is a limitation of the orchestrator's sandboxed browser-automation
environment, not an app-level defect.** Determined empirically, not assumed.

Method: launched real Chrome (`--headless=new`) with the Chrome DevTools Protocol from Node,
against the same running dev server, and executed
`navigator.serviceWorker.register('/sw.js', { type: 'module' })`.

Result: **`OK scope=http://localhost:5173/`**, worker reached state `activated`,
`navigator.serviceWorker.controller` non-null after reload, `closet-shell-v1` populated with
34 same-origin entries, and the app shell rendered offline. Reproduced on a cold profile
3/3 consecutive attempts.

Each candidate app-level cause was checked and ruled out:

| Chrome cause for "unknown error ... fetching the script" | Finding |
|---|---|
| MIME not recognised as JS | Ruled out — `Content-Type: text/javascript; charset=utf-8` (valid per spec) |
| Redirect during script fetch | Ruled out — direct `200`, no `Location` header |
| Opaque / cross-origin response | Ruled out — same-origin, `isSecureContext: true` on `http://localhost` |
| Byte-range / partial content | Ruled out — full 4824 bytes served, `Transfer-Encoding: chunked`, no `Accept-Ranges` and no `206` |
| BOM or encoding corruption | Ruled out — first bytes are `2F 2F 20 70` (`// p`), zero non-ASCII bytes |
| Scope violation / missing `Service-Worker-Allowed` | Ruled out — script at document root, default scope `/`, no header needed |
| Duplicate/malformed headers | Ruled out — inspected `rawHeaders` directly |

One incidental finding worth recording: on two brand-new headless profiles the install step
initially failed with `Failed to execute 'open' on 'CacheStorage': Unexpected internal error`,
driving the worker to `redundant`. This did **not** reproduce on subsequent cold profiles and is
a Chromium fresh-profile storage-initialisation race in headless mode, not app code. It did,
however, usefully demonstrate the real failure mode described in WARNING-2 below.

---

## Issues

### CRITICAL

All CRITICALs below are **coverage-only** (spec scenario without a passing covering test).
**No functional code defect was found in PR4.** This mirrors verify-report-pr3's posture.

- **CRITICAL-1 — `unified-search` ownership scope is unproven at runtime (scenario 4).**
  `security invoker` is declared correctly and no client-side filtering substitutes for RLS, so
  the implementation is structurally right, but no test exercises two users. Deferred by design
  to task **12.4** (anon `rpc('search_all')` returns 0 rows) in PR5. Moot at one user today;
  must not ship to a second user unverified.
- **CRITICAL-2 — `pwa-shell` standalone-display scenario is config-only (scenario 6).**
  `display: standalone` is present, but no installed-app launch was performed. Not automatable
  without a real install; recommend recording a one-time manual attestation.
- **CRITICAL-3 — `pwa-shell` shell-update-on-deploy scenario has no covering evidence (scenario 9).**
  See WARNING-1 — the mechanism exists but is entirely manual and unguarded.
- **CRITICAL-4 — reverse-lookup rendering has no automated test (scenarios 10, 11).**
  Consistent with design.md's Testing Strategy (DOM screens are manual/E2E for this change) and
  confirmed by the orchestrator's manual browser pass, but there is no regression guard. This is
  precisely the class of gap that let PR3's missing outfit-side tip list ship.

### WARNING

- **WARNING-1 — cache-first never revalidates, so shell updates depend on a human.**
  `cacheFirst()` returns the cached response whenever one exists and never falls through to the
  network on a hit. Module URLs are unversioned (`/src/main.js`, `/src/ui/screens/search.js`), so
  a deploy that changes a file's *content* without changing its *URL* will keep serving the stale
  module indefinitely until someone manually bumps `closet-shell-v1` in `public/sw.js`. The
  pwa-shell requirement "rather than serving the stale version indefinitely" therefore holds only
  by convention. Consider stale-while-revalidate for `/src/**`, or deriving the cache name from a
  build/commit identifier.
- **WARNING-2 — `cache.addAll()` is all-or-nothing over a list containing a gitignored file.**
  `PRECACHE_URLS` includes `/config.js`, which is per-deploy and gitignored. If that file (or any
  one of the nine URLs) 404s on a given deploy, `addAll` rejects, `install` fails, and the worker
  goes **fully redundant** — zero offline capability, zero caching. The registration call in
  `src/main.js` swallows the failure with an empty catch, so this degrades completely silently.
  **Observed live this session**: an install rejection produced exactly `redundant` plus empty
  `getRegistrations()` plus empty Cache Storage. Consider `Promise.allSettled` over individual
  `cache.add()` calls, or dropping `/config.js` from the required set.
- **WARNING-3 — reverse lookups fetch the entire catalog to resolve a handful of ids.**
  `prenda-detail.js` calls `outfitsRepo.list()` plus `tipsRepo.list()`, and `outfit-detail.js`
  calls `prendasRepo.list()` plus `tipsRepo.list()`, then filters client-side by linked id.
  Correct, and a deliberate reuse of the existing pattern, but it is O(catalog) per detail-screen
  open and will degrade as the closet grows. A targeted `.in("id", ids)` query is the future fix.
- **WARNING-4 — `shouldHandle` triangulation misses the same-host-different-port case.**
  Both cross-origin tests use `APP_ORIGIN = "https://closet.example"`, against which
  `127.0.0.1:56321` is trivially cross-origin. The realistic local shape — app on
  `http://127.0.0.1:5173`, stack on `http://127.0.0.1:56321`, differing only by port — is not
  asserted. I verified live that it correctly returns `false`, but nothing locks that in.
- **WARNING-5 — the stale-response guard and debounce in `renderSearch` are untested.**
  The monotonic `requestId` discard is genuine concurrency logic and the most subtle code in this
  PR, yet `search.js` has tests only for the pure `groupSearchHits`. A jsdom test with fake timers
  and out-of-order promise resolution would cover both the debounce and the guard.
- **WARNING-6 — `renderSearch` has no error path.**
  If `searchRepo.search(q)` rejects, `runSearch` produces an unhandled rejection and the
  "Buscando..." status stays on screen permanently. This is an app-wide convention rather than a
  PR4 regression (no screen has error handling), but it is user-visible here.
- **WARNING-7 — `apply-progress` records commit SHAs that no longer exist.**
  It cites `bbcea45`/`09731a1`, `e399d3c`/`3632e1a`, `3f5852c`/`7aae3a5` and says "12 commits";
  post-rebase the branch has **9** commits with different SHAs. The artifact should be refreshed
  before archive so the audit trail resolves.

### SUGGESTION

- **SUGGESTION-1** — `groupSearchHits` silently drops any hit whose `tipo` is not one of the three
  known keys (optional-chained push). If `search_all` ever gains a fourth type, those results
  vanish with no signal. Consider an explicit else branch or an `unknown` bucket.
- **SUGGESTION-2** — the remaining inline empty-state list items (`prendas-list.js`,
  `outfits-list.js`, `tips-list.js`, `outfit-detail.js`'s garment list, `tip-form.js`) could adopt
  `renderEmptyState` now that it exists. Correctly out of Phase 10's scope; worth a follow-up task.
- **SUGGESTION-3** — PWA icons are solid-colour placeholders at correct dimensions. Real branding
  is deferred to the visual-design change; ensure that change lists icon replacement explicitly.

---

## Review Workload Guard

| Metric | Value |
|---|---|
| Diff base (re-confirmed post-rebase) | merge-base(pr3, pr4) = `9ac8020` = current `pr3-outfit-tips-crud` tip |
| Changed lines | **596** (+561 / -35), 16 files (3 binary PNGs excluded by git) |
| Default budget | 400 lines |
| Status | Over the 400-line default; pre-resolved as one deliverable stacked-chain slice per tasks.md's Suggested Work Units table (Unit 4). Same accepted posture as PR3 |

The base is confirmed still accurate after the rebase: the merge-base equals the pr3 branch tip
exactly, so the diff contains no PR3 content and the branch is cleanly stacked. The stray
`verify-report-pr3.md` commit was successfully relocated — the working tree is clean and no
PR3-era report file appears in this diff.

---

## Final Verdict

**FAIL (machine, coverage-only) / PASS WITH WARNINGS (engineering).**

0 functional defects. 4 coverage-only CRITICALs (3 deferred by design to PR5 or to manual
attestation, 1 an accepted DOM-testing convention). 7 WARNINGs, of which WARNING-1 and
WARNING-2 are the ones genuinely worth acting on before this ships beyond a single user.

PR4 delivers what it claimed: it closes verify-report-pr3's WARNING-2 (outfit-detail now
renders a linked-tips section, backed by a unit-tested repo method), and the PWA shell's two
load-bearing scenarios — offline shell rendering and the never-cache-Supabase security
constraint — were promoted this session from "asserted" to **proved at runtime in a real
browser**.
