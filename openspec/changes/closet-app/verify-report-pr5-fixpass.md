```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3c91ecf284c88623099568e4d9075bfd9177a5dabc598cd6ca9d43e689baf758
verdict: fail
blockers: 1
critical_findings: 1
requirements: 9/20
scenarios: 28/41
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:98cc887b922cf03f7bd8c0edf7775ec027da297d73fb1392f098b1e4868123c7
build_command: node --check over all 26 tracked src/**/*.js, public/sw.js, scripts/*.mjs (no bundler; vanilla ES modules per design.md)
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report — closet-app PR5 Fix Pass

**Change**: closet-app
**Scope**: fix-pass commits `2168b68..0f317b8` on `closet-app/pr5-rls-suite`, on top of the
already-twice-verified PR5 tip `52f2a48`. This is a **narrow re-check**, not a full PR5 re-verify.
**Mode**: Strict TDD verify (hybrid persistence: OpenSpec file + Engram)
**Verified at**: HEAD `0f317b8`, tree `77978ff5c6b8334b219c4b335d08d31316922e22`

---

## Executive Answer

**2 of verify-report-pr5.md's 3 carried-over CRITICALs are genuinely closed. One remains open.**

The task framing ("closes the 3 carried-over CRITICALs": dual-attachment, staleWhileRevalidate,
reverse-lookup tests) does not match verify-report-pr5.md's own numbering. That report's three
CRITICALs were:

| verify-report-pr5.md ID | Subject | Closed by this fix pass? |
|---|---|---|
| CRITICAL-1 | pwa-shell "Installed app launches in standalone display" — no covering evidence | **NO — untouched** |
| CRITICAL-2 | Service worker never revalidates the cached shell | **YES** |
| CRITICAL-3 | Reverse-lookup rendering has no automated test | **YES** |
| WARNING-1 | Dual attachment detach-one-leaves-other proven only against fake repos | **PARTIALLY** (see WARNING-1 below) |

Dual attachment was **WARNING-1**, not a CRITICAL. `tasks.md` FP.1 labels it "the whole-change
CRITICAL-3 'Dual Attachment' coverage gap", which is a stale cross-reference to an earlier report and
inflates the apparent closure count. The installed-app standalone-launch CRITICAL received no code, no
test, and no recorded human attestation in this fix pass.

---

## Scope Integrity

| Check | Result | Evidence |
|---|---|---|
| PR5's original commits unaltered | OK | `52f2a48`, `8dfd79b`, `aeab14a` hashes resolve unchanged; fix pass is strictly additive on top of `52f2a48` |
| Fix pass touches no `src/` file | OK | `git diff --stat 52f2a48..0f317b8 -- src/` is empty |
| Working tree clean at verify time | OK | Only pre-existing untracked `pnpm-lock.yaml`, `pnpm-workspace.yaml` |
| All tasks checked | OK | 0 unchecked `- [ ]` entries in `tasks.md`; FP.1–FP.3 added and marked complete |

Fix-pass diff: 7 files, +808 / -14. Source surface is exactly one file (`public/sw.js`, +61/-14);
everything else is tests (313 added lines) and OpenSpec docs.

---

## Test Execution

```
$ npx vitest run
Test Files  27 passed (27)
     Tests  181 passed (181)
  exit code 0
```

**181/181 confirmed by independent count**, not taken on trust:

| File | Tests | Delta vs. 169 baseline |
|---|---|---|
| `tests/unit/sw-routing.test.js` | 13 | **+5** (`staleWhileRevalidate` describe block) |
| `tests/rls/dual-attachment.test.js` | 1 | **+1** (new file) |
| `tests/unit/ui/prenda-detail.test.js` | 3 | **+3** (new file) |
| `tests/unit/ui/outfit-detail.test.js` | 3 | **+3** (new file) |
| — | | **+12 -> 181** |

Build: `node --check` over all 26 tracked JS/MJS sources — exit 0, empty output.

---

## Claim 2 — `staleWhileRevalidate` Correctness

Read at `public/sw.js:90-114`. Each of the four required properties, judged against the code:

| # | Property | Verdict | Evidence in source |
|---|---|---|---|
| a | Serves cached response immediately, without awaiting the network | OK | `networkFetch` is created but **not awaited** on the cached path; `if (cached) return { response: cached, ... }` at L100-105 returns before any network `await` |
| b | Background revalidation failure is swallowed, never breaks the served response | OK | `revalidate: networkFetch.catch(() => undefined)` (L105). Attaching `.catch` also means no unhandled rejection |
| c | Cold cache + network failure **does** propagate | OK | L112 `const response = await networkFetch;` — rejection propagates out of the function |
| d | `cache.put` only on a successful response | OK | `if (response && response.ok) cache.put(request, response.clone())` (L94-96). `clone()` before returning the original, so the body is not consumed twice |

Additional read: on the cold path, `cache.put` receives the clone and the original is returned — correct
ordering. The `if (typeof self !== "undefined" ...)` guard (L125) keeps the module importable from plain
Node, which is what makes the five unit tests possible at all.

### Do the 5 tests actually exercise all four branches?

| Test (`tests/unit/sw-routing.test.js`) | Branch covered |
|---|---|
| "returns the cached response immediately when one exists" | (a), weakly — see SUGGESTION-1 |
| "kicks off a background fetch and updates the cache for next time when cached" | (a) + (d) positive: asserts `fetcher` called and `cache.put` called |
| "a failed background revalidation never rejects and never breaks the already-served cached response" | (b) — and incidentally the strongest proof of (a): with a **rejecting** fetcher the test still gets the cached response, which an implementation that awaited the network first could not do |
| "falls back to the network and caches the response when nothing is cached yet" | cold-cache happy path + (d) positive |
| "propagates a network failure when nothing is cached (true cold cache + offline)" | (c) — `rejects.toThrow("offline")` |

**Gap found**: no test drives `response.ok === false`. The `response.ok` guard — the entire point of
criterion (d) — is asserted only in its *positive* direction. An implementation that dropped the `.ok`
check and cached a 404/500 error page would pass all five tests. See WARNING-2.

This is not happy-path-only overall: two of five tests are failure-path tests, and they are the two that
carry the most weight. But the (d) negative branch is genuinely unexercised.

---

## Claim 3 — Dual-Attachment Real-DB Test

Read `tests/rls/dual-attachment.test.js` (91 lines, 1 test).

| Requirement from brief | Verdict | Evidence |
|---|---|---|
| Uses REAL repo calls, not mocks | OK | `makeLinksRepo(user.client)` — the real `src/data/links.js` factory, wired to an **authenticated user client**, not the RLS-bypassing admin client. No `vi.mock`, no fakes anywhere in the file |
| Runs against the live local Supabase stack | OK | `describe.skipIf(!hasSupabaseEnv)` + `assertConnected(admin)`; observed running for 1075ms against `supabase_db_closet-app` (a skipped suite would report 0ms/skipped) |
| Attaches to two **different** outfits | OK | `insertOutfit(... "fixture outfit 1")` and `insertOutfit(... "fixture outfit 2")` produce distinct rows; `linkOutfitTip(outfitOne.id, tip.id)` and `linkOutfitTip(outfitTwo.id, tip.id)` |
| Detaches only one | OK | Single `unlinkOutfitTip(outfitOne.id, tip.id)` |
| Queries the DB afterward, not an in-memory return value | OK | Three separate `admin.from("outfit_tip").select(...)` round-trips: a 2-row precondition, a 0-row detached assertion, and the 1-row survivor assertion. Nothing is inferred from the repo's own return value |
| Cleans up its fixtures | OK | `afterAll` runs `cleanupUserRows` + `deleteTestUser`; independently confirmed below |

The precondition assertion (`beforeRows` has length 2) is what makes the survivor assertion meaningful —
without it, a survivor count of 1 could be an artifact of the link never having been created.

**However**, see WARNING-1: this proves the wrong *shape* relative to the spec scenario it is credited
with closing.

### Independent DB cleanliness spot-check

Run via `docker exec supabase_db_closet-app psql`, **after** the full suite plus my own additional
RLS runs (read-only queries; I created nothing directly):

```
 users       | 1   -> test@closet.local only (the manual tester's account)
 outfit_tip  | 0
 outfit      | 0
 tip         | 0
 prenda      | 1   -> the manual tester's own row
```

Zero `dual-attach fixture` outfits, zero fixture tips, zero leftover `outfit_tip` rows, zero extra test
users. **No test pollution from this fix pass.** The dev server and Supabase stack were left running and
untouched; no `supabase stop`, no `db reset`.

---

## Claim 4 — RED-before-GREEN Discipline

### `staleWhileRevalidate` cycle — verified the standard way

Commit shapes (`git log --name-status`):

- `2168b68` — **test-only**: modifies `tests/unit/sw-routing.test.js` and nothing else.
- `15ff500` — **src-only**: modifies `public/sw.js` and nothing else.

Checked out `2168b68` in a detached worktree and ran the suite there:

```
FAIL tests/unit/sw-routing.test.js > staleWhileRevalidate > ...
TypeError: staleWhileRevalidate is not a function
Tests  5 failed | 8 passed (13)
```

RED is genuine and **fails for the right reason** — the symbol does not exist yet, not an assertion
mismatch or a setup error. All 5 new tests fail; all 8 pre-existing tests still pass, so the safety net
was intact across the change. Textbook cycle.

### Dual-attachment and reverse-lookup — the "no source fix was needed" deviation

The apply report claims no source change was required and substitutes a temporary-break-and-revert proof.
I assessed this independently rather than accepting the description.

**Is the premise true?** Yes, structurally and verifiably: `git diff --stat 52f2a48..0f317b8 -- src/`
is **empty**. `src/data/links.js`, `src/ui/screens/prenda-detail.js`, and `src/ui/screens/outfit-detail.js`
are byte-identical to their state at `52f2a48`. There is no hidden source change smuggled in alongside
the tests, and commits `2c206fa` and `160cadd` are test-file-additions only. A RED/GREEN commit split is
literally impossible when the delta contains no production code — demanding one here would mean demanding
a fake break commit.

**Did the break-and-revert actually prove anything?** I did not take this on trust — I re-ran it myself
in an isolated detached worktree at `0f317b8` (never in the live checkout, so the running dev server was
never affected):

| Break I applied | Result |
|---|---|
| `src/data/links.js` L32-33: `unlink("outfit_tip", { outfit_id, tip_id })` -> `unlink("outfit_tip", { tip_id })` (delete every row for the tip) | `dual-attachment.test.js` **FAILED at line 88** — the load-bearing survivor assertion, `expected 1, received 0`. Not at an incidental earlier assertion |
| `src/ui/screens/prenda-detail.js` L82: drop the `.filter((o) => linkedOutfitIds.has(o.id))` | `prenda-detail.test.js` **2 of 3 FAILED** (linked-only rendering and empty-state). `outfit-detail.test.js` correctly stayed green — the break was scoped to the garment screen |
| `git checkout -- src/` | All 7 tests green again; `git status` on `src/` clean |

**Assessment: legitimate, not hiding anything.** The tests are demonstrably non-vacuous — each fails at
the assertion that carries the claim, for the expected reason, and recovers on revert. The worktrees were
removed afterward (`git worktree remove --force`), and the `.env.local` I copied in for the RLS run was
deleted with them.

The only process criticism is bookkeeping, not substance: the break-and-revert is transient and leaves no
artifact in git history, so it is only as trustworthy as an independent re-run. I performed that re-run,
so it is now corroborated.

---

## Strict TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | OK | `tasks.md` FP.1-FP.3 describe cycle per item |
| All fix-pass claims have tests | OK | 3/3 claims have test files, all present on disk |
| RED confirmed | OK | `staleWhileRevalidate` RED reproduced at `2168b68`; the other two proven non-vacuous by independent break-and-revert |
| GREEN confirmed | OK | 181/181 pass at HEAD; each new file re-run individually |
| Triangulation | OK | 5 cases for `staleWhileRevalidate`; 3 each for the detail screens (linked / empty / click) |
| Safety net for modified files | OK | `sw-routing.test.js` had 8 passing tests before modification, all still passing at RED and GREEN |

### Test layer distribution (fix pass only)

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (plain Node) | 5 | 1 | vitest |
| Integration (jsdom, real render fns) | 6 | 2 | vitest + jsdom |
| Integration (real DB, real repos) | 1 | 1 | vitest + local Supabase Docker |
| **Total** | **12** | **4** | |

### Assertion quality

Audited all four fix-pass test files. **0 CRITICAL, 0 tautologies, 0 ghost loops, 0 smoke-only tests.**

Notably good: the detail-screen tests assert *exclusion* as well as inclusion — `allOutfits` deliberately
contains "Outfit no vinculado" and the assertion is `toEqual(["Outfit playero"])`, so a "render everything"
regression fails. Empty-state tests assert exact user-visible copy. Click tests assert the callback
received the correct id. These are behavioral, not structural. The `fakeResponse` helper in
`sw-routing.test.js` is a hand-rolled stub rather than a mock-heavy setup, and mock count never approaches
2x assertion count in any file.

One minor note: `expect(cache.put).toHaveBeenCalledWith("/src/main.js", expect.anything())` uses
`expect.anything()` for the second argument, so it does not verify *which* response was cached. Low impact
given the companion assertions, but it is why WARNING-2 below is possible.

Coverage: no coverage tool configured in `package.json` — coverage analysis skipped, not a failure.
Linter / type checker: none configured (vanilla ES modules, no TypeScript) — quality metrics skipped.

---

## Spec Compliance Delta

| Requirement | Scenario | Before | After | Evidence |
|---|---|---|---|---|
| App-Shell-Only Offline Caching | Service worker updates the cached shell on new deploys | UNTESTED | **COMPLIANT** | `staleWhileRevalidate` + 5 unit tests; self-heals every online visit, no manual `SHELL_CACHE` bump |
| Reverse Lookups on Garment Detail | Garment detail shows linked outfits and tips | UNTESTED | **COMPLIANT** | `prenda-detail.test.js` case 1 + `outfit-detail.test.js` case 1 |
| Reverse Lookups on Garment Detail | Garment with no links shows empty lists | UNTESTED | **COMPLIANT** | `prenda-detail.test.js` case 2 + `outfit-detail.test.js` case 2 |
| Dual Attachment | Detach from one relation leaves the other intact | PARTIAL | **PARTIAL** | See WARNING-1 — new test proves same-table independence, not the literal outfit-vs-garment scenario |
| Installability | Installed app launches in standalone display | UNTESTED | **UNTESTED** | Untouched by this fix pass |

**Whole-change totals: 28/41 scenarios compliant (was 25/41), 9/20 requirements fully complete (was 8/20).**

The one newly-complete requirement is garment-catalog "Reverse Lookups on Garment Detail" (both of its two
scenarios now covered). pwa-shell "App-Shell-Only Offline Caching" is **not** counted complete: its other
two scenarios' status is inherited from earlier reports and was not re-verified in this focused pass.

---

## Issues

### CRITICAL

- **CRITICAL-1 (carryover, still open) — installed-app standalone launch has no covering evidence.**
  pwa-shell scenario "Installed app launches in standalone display". This fix pass did not touch it: no
  manifest change, no test, and no recorded human attestation anywhere in the six commits. `design.md`
  line 352 explicitly assigns the PWA install path to manual verification, so this is dischargeable by a
  one-time written human attestation rather than by code — but until that attestation is recorded, the
  scenario has no evidence and the change is not archive-ready. **This is the sole remaining blocker.**

### WARNING

- **WARNING-1 — `dual-attachment.test.js` proves a different shape than the spec scenario it is credited
  with closing.** `styling-tips/spec.md:30-33` reads: *"GIVEN a tip attached to both an outfit **and a
  garment**, WHEN the owner detaches it from the **garment** only, THEN the garment's tip list MUST no
  longer include it, while the outfit's tip list MUST still include it."* The new test attaches one tip to
  **two outfits**, detaches one outfit, and asserts the other outfit's `outfit_tip` row survives. That is
  same-table row independence within `outfit_tip`; it never touches `prenda_tip` and therefore never proves
  cross-table independence, which is the literal risk the scenario describes. The test file's own header
  comment acknowledges the shape choice and argues it is "exactly the shape that proves row independence
  within the same join table" — a defensible engineering claim, and it does genuinely upgrade
  verify-report-pr5.md WARNING-1 from "fake repos only" to "real DB", but it does not make the spec
  scenario automated in its stated form. Closing it fully needs one more case: link the tip to an outfit
  *and* a prenda, `unlinkPrendaTip`, then assert the `outfit_tip` row survives. Low real-world risk
  (`unlinkOutfitTip` is table-scoped, so cross-table cascade is structurally implausible), but the
  regression guard the spec asks for is still absent.

- **WARNING-2 — the `response.ok` guard in `staleWhileRevalidate` is untested in its negative direction.**
  `public/sw.js:94` gates `cache.put` behind `response && response.ok`, but no test supplies a
  `fakeResponse(body, { ok: false })`. The helper already supports the flag — it is simply never used with
  `ok: false`. An implementation that cached a 404 or 500 error page (poisoning the shell cache with an
  error document that would then be served offline forever) passes all five current tests. This is exactly
  the branch criterion (d) exists to protect. One added test closes it: assert `cache.put` was **not**
  called when the fetcher resolves a non-ok response.

- **WARNING-3 — `event.waitUntil(revalidate)` does not actually keep the worker alive for the cache write.**
  In `public/sw.js:93-98` the `.then` callback calls `cache.put(request, response.clone())` without
  returning or awaiting it, then returns `response`. So `networkFetch` — and therefore the `revalidate`
  promise handed to `event.waitUntil` at L152 — settles **before** the cache write completes. The stated
  purpose of returning `revalidate` ("so the real fetch listener can `event.waitUntil(revalidate)` to keep
  the worker alive long enough for the background update to finish", L86-89) is therefore not achieved.
  In practice browsers usually complete the write anyway, so the feature mostly works, but the guarantee
  the comment claims is not the guarantee the code provides. Fix is one line:
  `return cache.put(request, response.clone()).then(() => response);`.

- **WARNING-4 — `tasks.md` FP.1 carries a stale CRITICAL cross-reference.** It labels the dual-attachment
  work as closing "the whole-change CRITICAL-3 'Dual Attachment' coverage gap", but in verify-report-pr5.md
  CRITICAL-3 is the reverse-lookup gap and dual attachment is WARNING-1. This is how the "3 CRITICALs
  closed" framing arose while the actual standalone-launch CRITICAL stayed open. Cosmetic in code terms,
  but it directly caused an overstated readiness claim, which is the kind of drift the verify gate exists
  to catch.

### SUGGESTION

- **SUGGESTION-1** — "returns the cached response immediately when one exists" would be strictly stronger
  with a fetcher that never settles (`new Promise(() => {})`), which proves non-blocking directly rather
  than inferring it from the rejecting-fetcher case.
- **SUGGESTION-2** — `expect(cache.put).toHaveBeenCalledWith(url, expect.anything())` could assert the
  cached body instead of `anything()`, which would incidentally have caught WARNING-2's class of defect.
- **SUGGESTION-3** — `SHELL_CACHE` remains the hardcoded `"closet-shell-v1"`. That is now correct rather
  than load-bearing (revalidation no longer depends on it), but the `activate` handler's comment at
  L135-137 still describes cache-name versioning as "the only invalidation mechanism", which is stale.

---

## Verdict

**FAIL** — as the whole-change gate, on one remaining blocker. Precisely:

- **The fix pass as a slice: PASS WITH WARNINGS.** It does exactly what it claims for the two CRITICALs it
  targeted, with real evidence. `staleWhileRevalidate` is correct on all four properties I checked. The
  dual-attachment test is a real-database, real-repo, post-hoc-queried, self-cleaning test — not a mock.
  The detail-screen tests exercise real render functions and assert exclusion, not just presence. RED/GREEN
  was properly split where source changed, and the no-source-change substitute proof holds up under
  independent re-execution. 181/181 green, zero test pollution, PR5's original commits untouched, `src/`
  otherwise byte-identical.
- **The closet-app change as a whole: FAIL / not archive-ready.** CRITICAL-1 (installed-app standalone
  launch) is still open and was never in this fix pass's scope. 28/41 scenarios and 9/20 requirements.

**Answer to the question asked: no, not all 3 of verify-report-pr5.md's carried-over CRITICALs are closed —
2 of 3 are.** CRITICAL-2 (service-worker revalidation) and CRITICAL-3 (reverse-lookup automated tests) are
genuinely, verifiably closed. CRITICAL-1 (installed-app standalone launch) remains open and requires a
one-time recorded human attestation, not code. The dual-attachment work — which the brief counted as the
third CRITICAL — was verify-report-pr5.md's WARNING-1, and it is upgraded but still not covering the spec
scenario in its literal form.

Nothing here blocks merging the fix pass. The fail verdict blocks **archiving** until CRITICAL-1 is
attested and WARNING-1 is either closed by one more test case or formally accepted in writing.

## Key Learnings

1. The fix pass closed two of three carried-over CRITICALs; the installed-app standalone-launch scenario was never in its scope and still needs a written human attestation.
2. A stale cross-reference in tasks.md FP.1 mislabeled dual attachment as CRITICAL-3, which manufactured an overstated "all three CRITICALs closed" claim.
3. Independent break-and-revert in a detached worktree is a valid non-vacuousness proof when the delta genuinely contains no production code, but the verifier must re-execute it because it leaves no git artifact.
4. The staleWhileRevalidate response.ok guard is unexercised in its negative direction, so an implementation caching error pages would pass all five new unit tests.
5. Calling cache.put without returning it means event.waitUntil(revalidate) does not actually keep the service worker alive for the background cache write.
