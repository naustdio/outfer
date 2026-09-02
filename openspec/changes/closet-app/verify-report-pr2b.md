```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b5b28fdae0c3af38dd15d4b9cd5973257b1c47050c7d0ae7438d9d628e4fe920
verdict: fail
blockers: 2
critical_findings: 2
requirements: 1/20
scenarios: 3/41
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:b688a9568b83c24ddd0e7ded1818cfcbe474fe30eae27575c8e38b2de53dcc25
build_command: node --check src/ui/router.js src/main.js src/app.js scripts/dev-server.mjs
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report - closet-app PR2.5 (Phase 6.5, router & entry point)

**Change**: `closet-app` | **Slice**: PR2.5
**Branch**: `closet-app/pr2b-router-entrypoint` @ `6ad74e1`, based on `closet-app/pr2-auth-garment-crud` @ `a0a86c0`
**Mode**: hybrid (OpenSpec + Engram) | **Strict TDD**: active
**Stated purpose**: close `verify-report-pr2.md` CRITICAL-3 - "the app still cannot be loaded in a browser at all".

## Executive verdict

**FAIL - 2 CRITICAL, 4 WARNING, 4 SUGGESTION.**

The router itself is genuinely good work: clean pure/impure split, honest RED-before-GREEN, 84/84 green, correct precedence, no trivial assertions. But **CRITICAL-3 is not closed**. Two independent defects each stop the app dead before a user can reach a single garment screen, and both were missed because the apply phase verified that *files are served* (curl) rather than that *the app runs* (browser). Its own apply-progress admits this: "Manual smoke check (login + garment CRUD by hand) is still recommended before treating this as fully verified."

## Completeness

| Task | Claim | Verified |
|---|---|---|
| 6.5.1 router + tests | `[x]` | PASS - `src/ui/router.js` + `tests/unit/ui/router.test.js`, 14 tests pass |
| 6.5.2 `src/main.js` entry point | `[x]` | WARN - file exists and is well-formed, but its module graph cannot load in a browser (CRITICAL-B) |
| 6.5.3 `public/index.html` shell | `[x]` | WARN - exists; missing import map (CRITICAL-B); `/config.js` absent (WARNING-1) |
| 6.5.4 dev script + server | `[x]` | PASS - `npm run dev` serves correctly; Windows `normalize()` fix is real |

All 4 Phase 6.5 tasks are checked and all 4 artifacts exist. Completeness is satisfied; **correctness is not**.

## Tests & build

- `npx vitest run` -> **84/84 passed**, 14 files, exit 0. The claimed count is exact (70 baseline + 14 router).
- `node --check` on all four changed/added JS sources -> exit 0.
- No linter, no type checker, no coverage tool configured -> those checks are reported as unavailable, not as failures.
- No browser automation installed (`playwright`/`puppeteer` absent), so browser findings below are established by module-resolution semantics plus served-response evidence, not by a headless run.

## CRITICAL

### CRITICAL-A - A successful sign-in never leaves the login screen

`app.js` `boot()` returns immediately after `showLogin()` when there is no session, so **`router.start()` is never called on the login path**. `router.start()` is the *only* place that registers the `hashchange` listener. When the user then signs in, `SIGNED_IN` fires and calls `router.navigate(...)`, which merely assigns `win.location.hash` - firing a `hashchange` event that **nobody is listening to**. The URL changes to `#/prendas` and the login form stays mounted forever.

Reproduced against the real `createApp` + real `createRouter`, wired exactly as `main.js` wires them, with a fake window and fake Supabase client:

```
after boot            -> rendered: NOTHING | loginFormPresent: true | hash: ""
hashchange listeners after boot: 0
after sign-in         -> rendered: NOTHING | loginFormPresent: true | hash: "#/prendas"
hashchange listeners after sign-in: 0
```

The auth *event mapping* is fine - `makeAuth.onAuthStateChange` forwards supabase-js's `(event, session)` and the `"SIGNED_IN"` string compares correctly. The bug is not the event, it is that **the router was never started**, so navigation has no subscriber. The same dead path affects `login.js`'s `onSignedIn` callback, which calls the identical `router.navigate`.

This is squarely a PR2.5 defect: the composition that fails is `main.js`'s, and it is the exact user journey PR2.5 exists to enable.

**Severity of fix: small - a mirror-the-pattern fix, comparable to PR2's two rounds.** Calling `router.start()` on the authenticated transition is enough, e.g. in `app.js`:

```js
if (event === "SIGNED_IN") {
  router.start();
  router.navigate(gate.consumeIntendedPath());
}
```

`start()` is safe to call again after `reset()`, and re-adding an identical `(type, fn)` pair is de-duplicated by the DOM. It needs a covering test - this whole class is currently untested, which is why it shipped.

### CRITICAL-B - The app cannot load in a browser: unresolvable bare module specifier

`public/index.html` loads `/src/main.js` as a raw ES module with **no bundler and no import map**. That module graph reaches `src/data/supabaseClient.js`, whose first line is:

```js
import { createClient } from "@supabase/supabase-js";
```

A browser cannot resolve a bare specifier without an import map. Verified: a search for `importmap` under `public/` returns no match, and `/node_modules/@supabase/supabase-js` returns **404** from the dev server (it only maps `/src/*` to the repo root and everything else to `public/`). The module graph therefore fails at load with a resolution error and `#app` stays empty - a blank page.

This means the headline goal is unmet. CRITICAL-3 asked that the app be loadable in a browser; it still is not. The apply phase's curl checks proved the *files* are delivered with correct content-types - which is true and which I reconfirmed - but serving `main.js` with `200 text/javascript` says nothing about whether its imports resolve once a browser parses it.

**Severity of fix: structurally bigger than CRITICAL-A**, and it is a real design decision rather than a typo. Options, all with tradeoffs against design.md's "vanilla ES modules, no build step":

1. Add an import map in `index.html` pointing `@supabase/supabase-js` at a CDN ESM build - keeps "no build step", adds a runtime CDN dependency and an offline/PWA problem for Phase 11.
2. Vendor a prebuilt ESM bundle into `public/vendor/` and import-map to it - no CDN, no bundler, but a committed artifact to refresh.
3. Introduce a bundler - contradicts design.md's stated constraint and is the largest change.

This needs an explicit orchestrator/user decision; apply should not freelance it.

## WARNING

1. **`/config.js` returns 404 - the "verified 200" claim does not hold in this tree.** `public/config.js` is correctly gitignored and `public/config.example.js` is correctly committed, but no `config.js` exists on disk now, so the running dev server returns `404 text/plain` for it. apply-progress claims curl verified it at 200; that is not reproducible at `6ad74e1`. Consequence in a clean checkout: `window.__CLOSET_APP_CONFIG__` is undefined, both values destructure to `undefined`, and `createSupabaseClient(undefined, undefined)` fails with an opaque supabase-js error rather than an actionable message. The copy step is documented in `config.example.js`'s header, so this is a WARNING and not a third blocker - but there is no README carrying it, and no friendly failure path.
2. **No "TDD Cycle Evidence" table in apply-progress.** The Strict TDD module treats a missing table as CRITICAL. I am recording it as WARNING because the substantive requirement was met by *stronger*, independently verifiable evidence: the git history itself. This is a reporting-format deviation, not a TDD failure.
3. **`src/app.js` was modified in `856da7c` with zero accompanying tests** (only the `client` injection param). That commit touched no test file at all. The untested auth/boot wiring in that same file is exactly where CRITICAL-A lives.
4. **`TOKEN_REFRESH_FAILED` is not a supabase-js v2 event.** `app.js` branches on it, but v2 emits `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `PASSWORD_RECOVERY`, `TOKEN_REFRESHED`, `USER_UPDATED`. That branch is dead code, so a genuinely failed refresh never resets the router or re-renders login.

## Route matching - exercised directly

Edge cases run against the real `parseHash`/`matchRoute` with `main.js`'s route table:

| Hash | Path | Match |
|---|---|---|
| `""`, `"#"`, `"#/"` | `/` | **NO MATCH** -> notFound |
| `#/prendas` | `/prendas` | `/prendas` OK |
| `#/prendas/` | `/prendas/` | `/prendas` OK (trailing slash tolerated) |
| `#prendas` | `/prendas` | `/prendas` OK (missing slash normalized) |
| `#/prendas/abc` | `/prendas/abc` | `/prendas/:id` id=`abc` OK |
| `#/prendas/new` | `/prendas/new` | `/prendas/new` OK (precedence correct) |
| `#/prendas/new/edit` | - | `/prendas/:id/edit` id=`new` (collision) |
| `#/prendas/<script>` | - | `/prendas/:id` id=`<script>` (unsanitized) |
| `#/prendas//` | - | NO MATCH |
| `#/prendas/1/edit/extra` | - | NO MATCH OK |
| `#/PRENDAS` | - | NO MATCH (case-sensitive) |
| `#/nope` | - | NO MATCH OK |

Precedence, param extraction, trailing-slash tolerance and the unmatched path all behave correctly. Two notes are carried to SUGGESTION.

## TDD compliance

| Check | Result | Detail |
|---|---|---|
| RED commit is test-only | PASS | `8df97f2` touches exactly one file: `tests/unit/ui/router.test.js` (+149) |
| RED fails for the right reason | PASS | Reproduced with the implementation removed: `Failed to load url ../../../src/ui/router.js` - absent implementation, not a bad assertion |
| GREEN commit is src-only | PASS | `3e80b69` touches exactly one file: `src/ui/router.js` (+132) |
| GREEN turns it green | PASS | 14/14 router tests pass at HEAD |
| Evidence table present | WARN | Absent from apply-progress (WARNING-2) |
| Entry-point commit tested | FAIL | `856da7c` added `main.js` + modified `app.js` with no test (WARNING-3) |

**Assertion quality**: All assertions verify real behavior. No tautologies, no ghost loops, no orphan empty-collection checks, no smoke-only tests, no CSS/implementation coupling, no mock-heavy files. Assertions check concrete values (`{ id: "42" }`, `"#/prendas"`, `["outfitId", "prendaId"]`) and both outcomes of the guard are exercised.

**Test layer distribution**: Unit 84 across 14 files (vitest). Integration 0. E2E 0 - no tooling installed, consistent with the explicit scope decision.

## Spec compliance

Authoritative totals, counted from `openspec/specs/*/spec.md`: **20 requirements, 41 scenarios**.

Coverage is **1/20 requirements, 3/41 scenarios - unchanged by PR2.5.** The router tests cover routing mechanics, which is not a spec scenario. `pwa-shell` remains **0/5**: its scenarios describe a loadable, installable app shell, and CRITICAL-B means the shell still does not load.

## Git & hygiene

- `git ls-files public/` -> `config.example.js`, `index.html`. `public/config.js` correctly absent and ignored (`.gitignore:10`).
- Branch correctly based on `a0a86c0`; the four claimed commits are present with the claimed roles and file scopes.
- Working tree carries three untracked files, none authored by this verification: `verify-report-pr2.md`, `probe-gate.mjs`, `probe-router.mjs`. The two `probe-*.mjs` are leftovers from the interrupted prior verify run and should be deleted before commit.
- Dev server responses reconfirmed: `/` 200 html, `/index.html` 200 html, `/src/main.js` 200 js, `/src/ui/router.js` 200 js, `/nope` 404, `/config.js` **404**.
- Local Supabase Auth stack at `http://127.0.0.1:56321` is up (`/auth/v1/health` -> 200). A real end-to-end sign-in was not driven through a browser because CRITICAL-B prevents the page from booting at all; CRITICAL-A was instead proven against the real modules.

## SUGGESTION

1. No `/` route exists, so a bare `#/` renders "Ruta no encontrada: /". A redirect from `/` to `/prendas` would be friendlier than a not-found for the app's own root.
2. `#/prendas/new/edit` resolves to `/prendas/:id/edit` with `id="new"`. Harmless today, but reserving `new` would prevent a confusing edit screen.
3. Route params flow unsanitized into handlers (`id="<script>"`). Supabase parameterizes the query and the screens use `textContent`, so there is no injection today - validating the id shape would keep it that way as screens grow.
4. `session-gate`'s `guard()` boolean return remains consumed by nobody, and `router.allow()`/`redirectToLogin()` are both no-ops - the gate's contract is now larger than its real behavior.

## Verdict

**FAIL.** PR2.5's router is well-built and honestly test-driven, but it does not achieve the one thing it exists to achieve. CRITICAL-3 stays open: with CRITICAL-B the page never boots, and even once it boots, CRITICAL-A means a successful login never reaches a garment screen.

Recommended next step is `sdd-apply` for one more bounded round: fix CRITICAL-A with a covering test (small), and take an explicit decision on CRITICAL-B's module-resolution strategy before implementing it (that one is a design call, not a patch). Do not archive.
