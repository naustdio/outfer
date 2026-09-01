# Exploration: closet-app — domain model, features, AI outfit-breakdown pipeline

## Current State

Greenfield project (git initialized, no code). `openspec/config.yaml` already records the stack as constraints: vanilla JS + GSAP + PWA frontend (static hosting), Node.js (Express or Fastify, open) backend on one Hostinger Node slot dedicated to the AI pipeline, Supabase (Postgres + Storage + Auth) queried directly from the frontend, OpenRouter routing to Gemini 2.5 Flash (vision) / Gemini 2.5 Flash Image "nano banana" (generation). Strict TDD is enabled; no test runner installed yet (Vitest recommended). No domain schema, API contracts, or UI exist — this is the first structuring of the previously-built Notion prototype's data model.

## Affected Areas (files to be created, none exist yet)

- `openspec/changes/closet-app/exploration.md` — this artifact
- Future: Supabase migration files, `openspec/specs/{catalog,outfits,styling-tips,ai-pipeline}/spec.md`

## Domain Model Summary

**Prenda**: nombre, fotos[], categoria (Superior/Inferior/Pies/Accesorios), tipo_prenda (open-ended select), marca, estado (En closet/Por comprar), link_compra, precio, favorito, colores (1-3, fixed catalog), talla, fecha_ingreso (editable, backfillable), cantidad, necesita_reparacion + tipo_dano[] + detalle_dano, temporada[], disponible (derived from estado). M:N with Outfits and Tips.

**Outfit**: titulo, nombre_sugerido (derived from distinct tipo_prenda of linked garments), imagen_inspiracion, notas, temporada[]. M:N with Prendas and Tips. estado fully derived: Disponible (all linked En closet) / Incompleto (>=1 Por comprar) / Sin prendas (none linked) — never manually set.

**Tip de Styling**: tip, descripcion, categoria[] (Colores/Texturas/Proporciones/Accesorios/Ocasion). M:N directly with BOTH Outfits and Prendas (dual attachment, not inherited).

Derived behaviors needed: reverse-lookup outfits-by-garment, garment's related tips, always-computed outfit completeness, unified cross-type search grouped by type (Prendas+Outfits+Tips).

## AI Outfit-Breakdown Pipeline (highest-complexity feature)

1. Photo upload → 2. Vision/detection (Gemini 2.5 Flash) returns generic per-garment categoria/tipo_prenda/colores, explicitly no brand/product ID → 3. Draft Prenda records, user reviews/edits/confirms (never auto-committed) → 4. Individual garment crops from original photo (not regenerated) → 5. AI-generated hero image (mannequin/catalog style, Gemini 2.5 Flash Image) → 6. Clickable hotspots on the hero mapping regions to Prenda pages, coordinates unknown until after generation.

## Approaches Compared

| Decision | Option | Pros | Cons | Effort |
|---|---|---|---|---|
| Outfit `estado` computation | DB view | Always correct, no write-path bugs | Not natively filterable like a stored column | Low |
| | Trigger-maintained column | Fast reads, filterable | Extra moving parts, drift risk, overkill at personal scale | Medium |
| | Client-side compute | Simple, no DB complexity | Duplicated logic if needed server-side later | Low |
| Hotspot coordinates | (a) Structured output from generation call | Single round-trip, no extra cost | Model's ability to return reliable coords for its own generated image is unverified | Low/High (unproven) |
| | (b) Secondary detection pass on generated hero | Reuses proven vision-call pattern, decoupled | Extra cost+latency, second misalignment risk | Medium |
| | (c) Manual hotspot placement (fallback UI) | Always works, zero AI cost, user control | Extra UI work; undermines "AI does it" value prop if primary | Medium |
| Draft garment representation | Status column (draft/confirmed/discarded) on Prenda | Simple, single table | Second status axis to filter everywhere | Low |
| | Separate staging table, promoted on confirm | Real table stays clean | Duplicate schema, promotion/relink complexity | Medium |

## Recommendation

Scope a first change to core catalog CRUD (Prendas/Outfits/Tips + Supabase schema/RLS decision + PWA shell) via `sdd-propose`. Keep the AI outfit-breakdown pipeline as a separate, later change — its risk profile (unproven hotspot-coordinate approach) is distinct enough that it shouldn't gate or complicate the low-risk core catalog work. Recommend a technical spike against the real Gemini 2.5 Flash Image API to test hotspot/coordinate feasibility before that later change reaches `sdd-design`.

## Risks

- Hotspot-coordinate resolution for the AI-generated hero image is unproven against the actual model API — may require a manual-placement fallback, changing scope late.
- Auth/RLS scope (single-user passcode vs. real Supabase Auth) is undecided and affects every table's schema shape; deciding late forces rework.
- No test runner installed yet; strict TDD requires the first implementation task to scaffold Vitest before any RED test.
- OpenRouter/Gemini pricing and the "genuine free tier" for Gemini 2.5 Flash should be re-verified at implementation time, not assumed to persist.
- Hostinger's single Node.js app slot permanently constrains backend architecture — future features compete for that one slot.

## Open Questions Flagged for sdd-propose / sdd-design (not decided here)

(a) Hotspot-coordinate-after-generation problem — structured output vs. secondary detection pass vs. manual fallback.
(b) Express vs. Fastify — low blast radius given the backend's narrow AI-pipeline-only scope; resolve against Hostinger Node constraints.
(c) Supabase schema/RLS: is this single-owner with a simple passcode/session, or real Supabase Auth with RLS on `auth.uid()`? Affects whether tables need a `user_id` column at all — must resolve before `sdd-spec`.
(d) Draft AI-detected garment lifecycle: status column vs. staging table; can a user partially confirm a detected batch; what happens to outfit/hero-image links if a draft is later discarded.
(e) Offline/PWA caching scope: app-shell only, or also cached garment/outfit data for offline browsing (requires local cache/IndexedDB + invalidation + reconnect conflict handling)?
(f) Minor: exact vocabulary for the fixed `colores` catalog (named colors vs. hex swatches) is unspecified.
(g) Minor: whether `tipo_prenda` should be a Postgres enum (migration-per-addition) or a lookup table (no-migration growth) — the "grows over time" requirement favors a lookup table.

## Ready for Proposal

Yes, for a first change scoped to core catalog CRUD — pending resolution of open question (c) (auth/RLS scope), which should happen before or during `sdd-propose` since it shapes schema from the start. The AI outfit-breakdown feature should be proposed as a separate, later change, ideally after a technical spike resolves open question (a).
