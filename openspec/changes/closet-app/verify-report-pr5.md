```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:eb965c8e3c9f22c0cdd31c6d4c39779117569812792d4a540122326e096ae897
verdict: fail
blockers: 3
critical_findings: 3
requirements: 8/20
scenarios: 25/41
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:475a5eaf56d6722d8a7cb5efdf68ba11934eef0bbb5bbdc758de26bd7c50954f
build_command: node --check over all tracked src/**/*.js, public/sw.js, scripts/*.mjs (no bundler; vanilla ES modules per design.md)
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report — closet-app PR5 (Phase 12)

**Change**: `closet-app`
**Slice**: PR5 — comprehensive RLS integration suite (`tests/rls/`), Phase 12. Last slice in the 5-PR stacked chain.
**Branch**: `closet-app/pr5-rls-suite` based on `closet-app/pr4-search-lookups-pwa` (tip `0ea1da9`)
**Mode**: Strict TDD
**Artifacts read**: `design.md`, `tasks.md`, Engram `sdd/closet-app/apply-progress` (#1362), and all four prior verify reports.

## Executive Verdict

PR5's own scope is clean and unusually well-evidenced. Every headline security claim was re-proved
independently against the live stack rather than accepted from the report, including a
transaction-scoped reproduction of both `security_invoker` footguns. **0 CRITICAL findings in PR5.**

Three claims in the apply report did not survive independent checking and are recorded as WARNINGs:
one is an overstatement about closing PR3's dual-attachment gap, one is an untested spec scenario the
suite was assumed to cover, and one is a live-environment side effect the orchestrator needs to know
about right now (the manual test user no longer exists).

## Completeness

| Metric | Value |
|--------|-------|
| Phase 12 tasks total | 8 (12.1-12.8) |
| Phase 12 tasks complete | 8 |
| Phase 12 tasks incomplete | 0 |
| All phases (1-12) marked complete | Yes — verified line by line in `tasks.md` |

Task 12.8 is a bonus task not in the original plan; it is legitimately additive (a real schema bug fix),
not scope creep used to pad completion.

## Build & Tests Execution

**Build**: Passed — `node --check` over 28 tracked source files, exit 0, empty output.

**Tests**: **169 passed (169)** across 24 test files, exit 0.

```text
$ npx vitest run
 ok tests/rls/pre-rls-anon-leak.test.js            (3 tests)
 ok tests/rls/lookup-tables.test.js                (9 tests)
 ok tests/rls/security-invoker-footguns.test.js    (4 tests)
 ok tests/rls/composite-fk-guard.test.js           (5 tests)
 ok tests/rls/derived-values.test.js               (5 tests)
 ok tests/rls/owned-tables.test.js                (33 tests)
 Test Files  24 passed (24)
      Tests  169 passed (169)
```

Counts confirmed exactly as claimed: **110 unit + 59 rls = 169**. RLS breakdown 3+9+4+5+5+33 = 59.
The suite was run twice in this session; both runs green, no cross-run collisions — the idempotency
claim holds.

**Coverage**: Not available — no coverage tool in devDependencies (dotenv, jsdom, vitest only). Not a failure.

## Independent Verification (not taken on trust)

Every check below was executed by me against the live stack (`supabase_db_closet-app`, kong `56321`).
All mutating probes ran inside BEGIN ... ROLLBACK; post-rollback state was re-read and confirmed restored.

### 1. security_invoker footgun on `outfit_v` — REPRODUCED

| Step | Result |
|---|---|
| `security_invoker = on` (shipped state), role anon | count = 0 |
| `security_invoker = off` (footgun), role anon | **count = 1 — leak reproduced** |
| After ROLLBACK | reloptions = {security_invoker=on}, 0 leftover rows |

The test is load-bearing, not vacuous: flipping the single reloption flips the assertion.

### 2. security_invoker footgun on `search_all()` — REPRODUCED

| Step | Result |
|---|---|
| `security invoker` (shipped state), role anon | anon_hits = 0 |
| `alter function search_all(text) security definer`, role anon | **anon_hits = 2 — both users' rows leaked** |
| After ROLLBACK | prosecdef = false, 0 leftovers |

This is design.md's self-declared "single highest-risk item in this change". Both halves are genuinely closed.

### 3. Two-user isolation — INDEPENDENTLY CONFIRMED

Probed through the real PostgREST access path (`set role authenticated` plus a `request.jwt.claims` sub),
with my own users, not the suite's:

- user A sees exactly its own garment, and nothing of user B
- user B sees exactly its own garment, and nothing of user A

`setup.js`'s `createTestUser` was traced: it calls `admin.auth.admin.createUser` (real Auth Admin API)
with a Date.now-plus-counter unique email and performs a real `signInWithPassword`. The two users are
genuinely distinct principals with distinct JWTs — not two handles onto one identity. The headline new
capability is real.

### 4. Composite-FK cross-tenant impossibility — CONFIRMED

Live constraint definitions match design.md exactly:

```
outfit_prenda -> outfit (FOREIGN KEY (outfit_id, user_id) REFERENCES outfit(id, user_id) ON DELETE CASCADE)
outfit_prenda -> prenda (FOREIGN KEY (prenda_id, user_id) REFERENCES prenda(id, user_id) ON DELETE CASCADE)
prenda_tip    -> prenda / tip     (same composite shape)
outfit_tip    -> outfit / tip     (same composite shape)
```

`composite-fk-guard.test.js` asserts the specific code 23503 through the RLS-bypassing service-role
client, so RLS cannot be the rejector — the argument is structural, and all 5 tests pass.

### 5. Migration 0006 — THE BUG IS REAL, THE FIX IS CORRECT AND MINIMAL

Line 42 of `supabase/migrations/0001_types_and_lookups.sql` granted only select and insert on
tipo_prenda to both authenticated and service_role, so service_role really was missing UPDATE/DELETE.
Live grants after 0006:

| Grantee | Privileges |
|---|---|
| anon | SELECT (plus REFERENCES/TRIGGER/TRUNCATE) |
| authenticated | SELECT, INSERT — **no UPDATE/DELETE (append-only preserved)** |
| service_role | SELECT, INSERT, **UPDATE, DELETE** |

The fix grants only service_role; the intentional append-only restriction on authenticated is untouched.
The paired down migration exists and reverses exactly that grant.

### 6. RLS posture across all 8 tables — CONFIRMED

| Table | RLS | Policies |
|---|---|---|
| prenda, outfit, tip, outfit_prenda, prenda_tip, outfit_tip | on | owner_all (FOR ALL) |
| colores | on | read_catalog (SELECT) |
| tipo_prenda | on | read_catalog (SELECT), add_tipo (INSERT) |

Exactly the shape design.md specifies. No table left unenabled, no table left policy-less by accident.

### 7. Test pollution — NONE

Final live counts after two full suite runs plus all my probes: auth.users 0, rls-test users 0, my own
probe users 0, prenda 0, outfit 0, tip 0, tipo_prenda back to exactly its seeded 20, and zero rows
matching the suite's RLS-test tipo_prenda naming pattern. Cleanup discipline in `setup.js`
(`cleanupUserRows` plus `deleteTestUser` in every afterAll) is correctly wired.

### 8. Review budget — CONFIRMED

`git diff --stat closet-app/pr4-search-lookups-pwa..closet-app/pr5-rls-suite` gives 9 files,
+745/-7 = **752 changed lines**, matching the apply report exactly. Under the session's 800-line budget;
no exception needed. Note also that 745 of those lines are test code and 17 are SQL, so reviewer risk is
low relative to the raw line count.

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | Yes | apply-progress documents RED-equivalent evidence per file |
| All tasks have tests | Yes | 12.1-12.6 map to 6 files; 12.7 doc-only; 12.8 migration |
| RED confirmed | Yes | Re-derived myself for the two highest-value files (sections 1 and 2) rather than trusting the report |
| GREEN confirmed | Yes | 59/59 RLS tests pass on my own execution |
| Triangulation adequate | Yes | derived-values asserts three different values (Sin prendas / Disponible / Incompleto); owned-tables parameterises 6 tables across 5-6 operations |
| Safety net | Yes | All 6 files are new; the one modified file (tasks.md) is documentation |

The apply phase used a break-the-schema-and-re-run method for RED rather than a literal RED commit.
That is the right call for integration tests, and I verified the substance of it independently.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 110 | 18 | vitest, jsdom |
| Integration (real DB) | 59 | 6 | vitest against local Supabase |
| E2E | 0 | 0 | not installed (manual per design.md) |
| **Total** | **169** | **24** | |

## Assertion Quality

Scanned all 6 files. No tautologies, no toBeDefined-only assertions, no smoke tests, no mock-heavy
tests, no ghost loops. Every negative assertion is paired with a positive counterpart, which is exactly
what prevents a "nothing works" false pass.

| File | Line | Pattern | Issue | Severity |
|---|---|---|---|---|
| owned-tables.test.js | 162 | conditional `if (!aUpdErr) expect(...)` | No unconditional follow-up; the write half of two-user isolation asserts nothing when an error is returned, and user B's row is never re-read to confirm it is unchanged | WARNING |
| owned-tables.test.js | 121, 129, 201 | conditional `if (!error) expect(...)` | Also conditional, but each is followed by an unconditional admin re-read that verifies the row is intact — acceptable | none |

**Assertion quality**: 0 CRITICAL, 1 WARNING.

## Spec Compliance — PR5-owned scenarios

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Deny-by-Default RLS | Table with RLS and no policy denies all access | lookup-tables.test.js (anon SELECT 0 despite grant) | COMPLIANT |
| Deny-by-Default RLS | Owner can access only their own rows | owned-tables.test.js two-user isolation across 6 tables | COMPLIANT |
| Zero Access for Anonymous Client | Anon SELECT returns nothing | owned-tables + security-invoker-footguns | COMPLIANT |
| Zero Access for Anonymous Client | Anon INSERT/UPDATE/DELETE rejected | owned-tables.test.js | COMPLIANT |
| Row Ownership | New row stamped with the creator's ownership | none — runtime-proven by me, see WARNING-2 | PARTIAL |
| Derived Availability | Direct write to disponible is rejected | derived-values.test.js | COMPLIANT |
| Derived Outfit Status | 0 / all-available / mixed garments | derived-values.test.js | COMPLIANT |
| Derived Suggested Name | Distinct types, orden-ordered | derived-values.test.js | COMPLIANT |
| Search Respects Ownership Scope | Search never returns another user's data | security-invoker-footguns (anon) plus my two-user probe | COMPLIANT |
| Dual Attachment | Detach from one relation leaves the other intact | tip-attach.test.js (fake repos only) | PARTIAL |

**Whole-change totals**: 25/41 scenarios compliant, 8/20 requirements fully complete.

## Design Coherence

| Design decision | Followed? | Evidence |
|---|---|---|
| user_id on all owned tables with default auth.uid() | Yes | Probed: an insert omitting user_id stamped the caller's uid |
| Denormalized user_id plus composite FK on join tables | Yes | Live pg_constraint output matches design verbatim |
| One FOR ALL owner policy per owned table | Yes | owner_all present on all 6 |
| Views must be security_invoker = on | Yes | Verified, and the failure mode reproduced |
| search_all must be security invoker | Yes | prosecdef false; the definer variant reproduced as a leak |
| RLS suite isolated in its own Vitest project, skipped without SUPABASE_URL | Yes | describe.skipIf guard in all 6 files |
| Fail loudly if SUPABASE_URL is set but the stack is unreachable (12.1) | Yes | assertConnected throws an actionable error |

No design deviations found.

## Issues

### CRITICAL

**PR5 itself contributes zero CRITICAL findings** — no functional defect, no untested claim within its
own scope. The three CRITICALs below are **carried forward from verify-report-pr4.md**, are all
coverage-only (a spec scenario with no passing covering test), and are counted here because this is the
final verification of the whole change, not a slice-only gate.

- **CRITICAL-1 (carryover) — installed-app standalone launch has no covering evidence.**
  pwa-shell scenario "Installed app launches in standalone display". The manifest sets
  display: standalone, but no installed-app launch was ever performed. design.md line 352 explicitly
  assigns the PWA install path to manual verification, so this is dischargeable by a one-time human
  attestation rather than by code.
- **CRITICAL-2 (carryover) — the service worker does not demonstrably update the cached shell on deploy.**
  pwa-shell scenario "Service worker updates the cached shell on new deploys". Confirmed still open in
  this pass: cacheFirst() returns any cached response and never revalidates, and SHELL_CACHE is still
  the hardcoded closet-shell-v1. With unversioned module URLs, a content-only deploy keeps serving the
  stale module until a human bumps the cache name. Unlike CRITICAL-1 this is not manual-sanctioned by
  design.md, and there is a real mechanism weakness behind it.
- **CRITICAL-3 (carryover) — reverse-lookup rendering has no automated test.**
  garment-catalog scenarios "Garment detail shows linked outfits and tips" and "Garment with no links
  shows empty lists". Confirmed still open: no prenda-detail or outfit-detail test file exists. This is
  precisely the class of gap that let the missing outfit-side tip list ship in PR3.

### WARNING

- **WARNING-1 — the apply report overstates closure of PR3's dual-attachment gap.**
  verify-report-pr3.md flagged that "detach from one relation leaves the other intact" needs real-DB
  integration proof. PR5's suite creates both a prenda_tip and an outfit_tip link for the same tip, but
  no test ever deletes one and asserts the other survives. The only coverage remains
  tests/unit/ui/tip-attach.test.js, which injects fake repos and asserts call shapes, not database
  behavior. I proved the behavior correct myself (deleting the outfit_tip row left prenda_tip at 1 and
  the tip row intact), so this is a coverage gap, not a defect — but the chain should not record PR3's
  flag as closed by an automated test, because it is not.

- **WARNING-2 — default auth.uid() row stamping has no automated test.**
  Spec scenario "New row is stamped with the creator's ownership". Every RLS fixture inserts an explicit
  user_id through the service-role client, so the default auth.uid() path is never exercised by the
  suite. I confirmed it works at runtime, but nothing guards it against regression.

- **WARNING-3 — the local database is empty; test@closet.local no longer exists.**
  auth.users count is 0, and prenda/outfit/tip are all 0. The `supabase db reset --local` performed
  during apply (to verify all 6 migrations apply from scratch) wiped the manual test account and its
  garment and outfit. This is not test pollution and not a code defect, but the task brief assumed that
  user was live in a browser session — whoever is manually testing will hit an invalid-credentials error
  and must re-create the account. I did not create or delete anything to cause this, and I left the dev
  server and the Docker stack running and untouched.

- **WARNING-4 — conditional assertion at owned-tables.test.js line 162** (see Assertion Quality).
  Unlike its siblings it has no unconditional admin re-read, so the write half of two-user isolation can
  silently assert nothing. One added re-read of user B's row would close it.

- **WARNING-5 — search_all cross-user isolation is proven only for anon in the suite.**
  The automated test covers anon (0 rows) and the owner positive case. The second-authenticated-user
  case — the literal wording of the spec scenario — is not automated. I verified it live (user A's
  search returned only its own row; user B's returned only its own two rows), so the scenario is
  satisfied today, but the regression guard is indirect.

### SUGGESTION

- owned-tables.test.js covers no UPDATE on join tables and no owner DELETE on entity tables. The FOR ALL
  policy makes this low risk, but the matrix is not quite complete.
- The search_all owner positive case asserts prenda and outfit hits but never a tip hit, so "query
  matches across all three types" is two-thirds proven at the RPC level.
- Consider promoting my two rolled-back psql probes (the view and function footgun toggles) into a
  documented manual runbook step; they are the cheapest possible regression check for the highest-risk item.

## Whole-Change Readiness (all 5 PRs)

Asked plainly: is closet-app feature-complete for its original scope? **Yes.** Is it archive-ready? **Not yet.**

**Feature-complete — yes.** All 12 phases are genuinely marked complete in tasks.md, and I found no phase
marked complete without corresponding code. Every capability in the original scope exists: migrations and
RLS, data and domain layers, the auth gate, garment/outfit/tip CRUD, linking and dual attachment, unified
search, reverse lookups, the PWA shell, and now the security proof. The two deliberate exclusions
(ui/transitions.js plus GSAP, deferred to the visual-design change; and the AI outfit breakdown, a
separate change) were scoped out during planning rather than dropped. The security posture in particular
is now the best-evidenced part of the change — it is no longer asserted, it is demonstrated.

**Archive-ready — not yet.** CRITICALs from verify-report-pr4.md are carried forward, because PR5 is
RLS-only and never touched them:

| Carryover | Status after PR5 | Note |
|---|---|---|
| PR4 CRITICAL-1 — search ownership scope unproven at runtime | Resolved | Closed by PR5's anon test plus my two-user probe |
| PR4 CRITICAL-2 — installed-app standalone launch | Open, manual-sanctioned | design.md line 352 explicitly assigns PWA install to manual; needs a one-time attestation, not code |
| PR4 CRITICAL-3 — service worker updates cached shell on deploy | Open | Confirmed still open: cacheFirst never revalidates and SHELL_CACHE is still the hardcoded closet-shell-v1 |
| PR4 CRITICAL-4 — reverse-lookup rendering has no automated test | Open | Confirmed still open: no prenda-detail or outfit-detail test file exists |
| PR4 WARNING-2 — precache all-or-nothing | Resolved | precacheBestEffort landed in commit 4e424f9, covered by 3 tests |

Recommended before archive: record the manual PWA attestation (CRITICAL-2), and decide explicitly whether
CRITICAL-3 (cache revalidation) and CRITICAL-4 (detail-screen tests) are fixed now or converted into
tracked follow-up items with the risk accepted in writing.

## Verdict

**FAIL** — as the final, whole-change verification gate. To be precise about what is and is not failing:

- **PR5 as a slice: PASS.** Zero CRITICAL findings, 169/169 tests green, every headline security claim
  independently reproduced against the live stack, zero test pollution, and diff size within budget.
  This is the strongest-evidenced slice in the chain and I recommend merging it.
- **The closet-app change as a whole: FAIL / not archive-ready.** 25 of 41 spec scenarios have passing
  covering tests and 8 of 20 requirements are fully complete. Three coverage-only CRITICALs carried over
  from PR4 remain unresolved, because PR5 was RLS-only by design and never touched the PWA shell or the
  detail screens.

The change is **feature-complete** for its original scope but not **verification-complete**. Nothing here
blocks merging PR5; the fail verdict blocks archiving the change until the three carryover CRITICALs are
either fixed or formally accepted in writing.
