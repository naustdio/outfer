# Design: Core Catalog CRUD (Prendas, Outfits, Tips)

## Technical Approach

Schema-first, frontend-direct-to-Supabase, no server tier. Postgres owns identity (Supabase Auth), authorization (RLS on every table), and all cross-row derivation (views + generated columns). The browser owns rendering, navigation, form validation, and session gating. A thin `src/data/` layer is the only module that touches the Supabase SDK, so every query is unit-testable against a mocked client; `src/domain/` is deliberately thin because derivation moved into the database; `src/ui/` never imports the SDK.

The security posture is deny-by-default: RLS is enabled on every table, policies are granted only to the `authenticated` role, and no policy exists for `anon`. A client holding only the public anon key therefore reads and writes zero rows everywhere. The login screen is UX, not the boundary — the boundary is RLS.

## Architecture Decisions

### Decision: Real Supabase Auth (email/password), one owner, ownership column everywhere

**Choice**: `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` on all nine tables (3 entities + 3 join tables + no `user_id` on the 2 lookup tables). Single account provisioned via the Supabase dashboard; the app ships no signup or password-reset UI.
**Alternatives considered**: client-side passcode with no RLS (original proposal); RLS via a single hardcoded owner UUID.
**Rationale**: the anon key is public in a static PWA — a client-side gate protects nothing. `auth.uid()` scoping costs the same effort as a hardcoded UUID but needs zero rework if a second user ever exists. `default auth.uid()` keeps inserts from having to send `user_id`, and `WITH CHECK` prevents forging it.

### Decision: Denormalize `user_id` onto join tables + composite FK to block cross-user links

**Choice**: join tables carry `user_id` and reference parents by `(id, user_id)`, backed by `unique (id, user_id)` on each entity table.
**Alternatives considered**: join-table RLS via `EXISTS` subqueries against both parents.
**Rationale**: subquery policies run on every row of every query and are easy to get subtly wrong. The composite FK makes a link between two different users' rows structurally impossible, and the join-table policy stays a flat `user_id = auth.uid()` comparison. Cost: one redundant column and one extra unique index per entity.

### Decision: `FOR ALL` policy per table, not four per-operation policies

**Choice**: one `create policy ... for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())` per owned table.
**Alternatives considered**: four named SELECT/INSERT/UPDATE/DELETE policies per table (36 policies total).
**Rationale**: at single-owner scope the four policies would be byte-identical, and 36 near-duplicates is more audit surface, not less. `USING` governs SELECT/UPDATE/DELETE row visibility, `WITH CHECK` governs INSERT and post-UPDATE rows — both clauses are present, so no operation is unguarded. Splitting later is purely additive.

### Decision: `disponible` is a generated column; `outfit.estado` / `nombre_sugerido` are views

**Choice**: `disponible boolean generated always as (estado = 'En closet') stored`. Outfit derivations live in `outfit_v`.
**Alternatives considered**: a view for `disponible` too (proposal's default); trigger-maintained columns for both.
**Rationale**: the proposal rejects trigger columns because of write-path drift. A generated column has no write path — Postgres refuses direct writes and recomputes from the same row — so it carries the view's correctness guarantee *and* is indexable. Outfit derivations aggregate across rows and cannot be generated columns, so they stay views.

### Decision: Views must be `security_invoker = on`

**Choice**: every view is created with `with (security_invoker = on)`.
**Rationale**: this is the single highest-risk footgun here. A default Postgres view executes with the view *owner's* privileges and silently bypasses the underlying tables' RLS — meaning `outfit_v` would leak every row to anyone who can select from it. `security_invoker` makes the caller's RLS apply. Same class of trap as `security definer` functions.

### Decision: Unified search as one `security invoker` RPC

**Choice**: `search_all(q text)` returns `(tipo text, id uuid, titulo text, subtitulo text)` — three `ilike` branches unioned inside the function, default `SECURITY INVOKER`.
**Alternatives considered**: three parallel `ilike` queries merged and grouped in JS.
**Rationale**: one round trip instead of three, one ranking/ordering rule, and the RPC signature is a stable client contract — swapping `ilike` for `tsvector` + GIN later changes zero frontend code. Critically, `SECURITY INVOKER` (the default, stated explicitly in the migration) means the function body's queries run under the caller's RLS, so results can never cross users. A `SECURITY DEFINER` search function would be the exact bug the RLS work exists to prevent.

### Decision: `colores` = fixed enum + metadata table; `tipo_prenda` = growable lookup table

**Choice**: `create type color as enum (...)` with `prenda.colores color[]` and `check (array_length(colores,1) between 1 and 3)`; a `colores` table `(valor color primary key, nombre text, hex text, orden smallint)` supplies swatch hex and display order. `tipo_prenda` is a real table `(id, nombre unique, categoria categoria_prenda, orden smallint)`.
**Alternatives considered**: a fourth `prenda_color` join table; hex-only free-text colors; `tipo_prenda` as an enum.
**Rationale (colores)**: the requirement calls the color catalog *fixed*, so migration-to-extend is acceptable and the enum gives type safety plus a trivial 1–3 constraint without a fourth join table. Named-canonical beats hex-only because "show me black garments" is meaningless across forty near-blacks; the sidecar table still gives the UI one hex per name for swatches — names for querying, hex for rendering.
**Rationale (tipo_prenda)**: this vocabulary is explicitly open-ended, so a table the user can insert into beats an enum needing a migration per new garment type. `categoria` on the lookup filters the type dropdown by the selected category, and `orden` gives `nombre_sugerido` a deterministic, human-sensible sequence (outerwear → top → bottom → shoes) instead of alphabetical noise.

### Decision: Refetch after mutation instead of client-side re-derivation

**Choice**: after any link/unlink or garment `estado` change, the UI refetches the affected `outfit_v` row rather than recomputing `estado`/`nombre_sugerido` in JS.
**Alternatives considered**: mirror the derivation rules in `src/domain/` for optimistic updates.
**Rationale**: mirroring reintroduces exactly the dual-implementation drift the DB-derivation decision was made to eliminate. At personal scale one extra round trip is invisible. This is what leaves `src/domain/` thin — see Interfaces.

## Schema DDL Sketch

```sql
-- types & lookups
create type categoria_prenda as enum ('Superior','Inferior','Pies','Accesorios');
create type estado_prenda    as enum ('En closet','Por comprar');
create type temporada        as enum ('Primavera','Verano','Otono','Invierno','Atemporal');
create type tipo_dano        as enum ('Costura/Bastilla','Boton','Cierre','Mancha','Descosido','Desgaste','Otro');
create type categoria_tip    as enum ('Colores','Texturas','Proporciones','Accesorios','Ocasion');
create type color            as enum ('Negro','Blanco','Gris','Beige','Cafe','Azul','Azul marino','Celeste',
                                      'Verde','Verde oliva','Amarillo','Naranja','Rojo','Vino','Rosa',
                                      'Morado','Dorado','Plateado','Multicolor','Estampado');

create table colores (            -- UI metadata sidecar for the enum, not a FK target
  valor  color primary key,
  nombre text    not null,
  hex    text    not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  orden  smallint not null
);

create table tipo_prenda (        -- growable without migrations
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  categoria categoria_prenda not null,
  orden     smallint not null default 100   -- drives nombre_sugerido sequencing
);

-- entities
create table prenda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  categoria categoria_prenda not null,
  tipo_prenda_id uuid not null references tipo_prenda(id),
  marca text,
  estado estado_prenda not null default 'En closet',
  disponible boolean generated always as (estado = 'En closet') stored,
  colores color[] not null check (array_length(colores,1) between 1 and 3),
  talla text,
  link_compra text,
  precio numeric(10,2),
  favorito boolean not null default false,
  fecha_ingreso date not null,          -- user-editable, NOT created_at
  cantidad integer not null default 1 check (cantidad > 0),
  necesita_reparacion boolean not null default false,
  tipo_dano tipo_dano[] not null default '{}',
  detalle_dano text,
  temporada temporada[] not null default '{}',
  fotos text[] not null default '{}',   -- Supabase Storage object paths
  created_at timestamptz not null default now(),
  unique (id, user_id)                  -- composite-FK target
);

create table outfit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null,
  imagen_inspiracion text,
  notas text,
  temporada temporada[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table tip (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tip text not null,
  descripcion text,
  categoria categoria_tip[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- join tables: composite FKs make cross-user links structurally impossible
create table outfit_prenda (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  outfit_id uuid not null,
  prenda_id uuid not null,
  primary key (outfit_id, prenda_id),
  foreign key (outfit_id, user_id) references outfit(id, user_id) on delete cascade,
  foreign key (prenda_id, user_id) references prenda(id, user_id) on delete cascade
);

create table prenda_tip (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prenda_id uuid not null, tip_id uuid not null,
  primary key (prenda_id, tip_id),
  foreign key (prenda_id, user_id) references prenda(id, user_id) on delete cascade,
  foreign key (tip_id,    user_id) references tip(id, user_id)    on delete cascade
);

create table outfit_tip (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  outfit_id uuid not null, tip_id uuid not null,
  primary key (outfit_id, tip_id),
  foreign key (outfit_id, user_id) references outfit(id, user_id) on delete cascade,
  foreign key (tip_id,    user_id) references tip(id, user_id)    on delete cascade
);

create index on prenda(user_id);           create index on outfit(user_id);
create index on tip(user_id);              create index on prenda(tipo_prenda_id);
create index on outfit_prenda(prenda_id);  create index on prenda_tip(tip_id);
create index on outfit_tip(tip_id);
```

### Derived view

```sql
create view outfit_v with (security_invoker = on) as   -- MANDATORY: else RLS is bypassed
select o.*,
       case when agg.n = 0            then 'Sin prendas'
            when agg.todas_en_closet  then 'Disponible'
            else 'Incompleto' end            as estado,
       agg.nombre_sugerido,
       agg.n                                 as prendas_count
from outfit o
left join lateral (
  select count(*)                                        as n,
         coalesce(bool_and(p.estado = 'En closet'), true) as todas_en_closet,
         (select string_agg(t.nombre, ' + ' order by t.orden, t.nombre)
            from (select distinct tp.nombre, tp.orden
                    from outfit_prenda op2
                    join prenda p2      on p2.id = op2.prenda_id
                    join tipo_prenda tp on tp.id = p2.tipo_prenda_id
                   where op2.outfit_id = o.id) t)        as nombre_sugerido
    from outfit_prenda op join prenda p on p.id = op.prenda_id
   where op.outfit_id = o.id
) agg on true;
```

`prenda` needs no view — `disponible` is a generated column on the table itself. A thin `prenda_v` may still be added later purely to denormalize `tipo_prenda.nombre`; it is not required for this change.

### RLS policies

```sql
alter table prenda        enable row level security;
alter table outfit        enable row level security;
alter table tip           enable row level security;
alter table outfit_prenda enable row level security;
alter table prenda_tip    enable row level security;
alter table outfit_tip    enable row level security;
alter table tipo_prenda   enable row level security;
alter table colores       enable row level security;

-- owned tables (repeat verbatim for all six)
create policy owner_all on prenda for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- shared vocabulary: readable by any authenticated user, never by anon
create policy read_catalog on colores     for select to authenticated using (true);
create policy read_catalog on tipo_prenda for select to authenticated using (true);
-- tipo_prenda is append-only vocabulary; no update/delete policy exists = denied
create policy add_tipo     on tipo_prenda for insert to authenticated with check (true);
```

| Table | SELECT | INSERT | UPDATE | DELETE | `anon` role |
|---|---|---|---|---|---|
| `prenda`, `outfit`, `tip` | `user_id = auth.uid()` | `WITH CHECK user_id = auth.uid()` | both clauses | `user_id = auth.uid()` | no policy → denied |
| `outfit_prenda`, `prenda_tip`, `outfit_tip` | `user_id = auth.uid()` | `WITH CHECK user_id = auth.uid()` + composite FK | both clauses | `user_id = auth.uid()` | no policy → denied |
| `colores` | all authenticated | denied | denied | denied | no policy → denied |
| `tipo_prenda` | all authenticated | allowed (append-only) | denied | denied | no policy → denied |
| `outfit_v` (view) | inherits via `security_invoker` | n/a | n/a | n/a | denied |

No policy is granted to `anon` or `public` anywhere. `enable row level security` with zero applicable policies is a hard deny, which satisfies the success criterion that an anon-key client reads and writes zero rows.

## Frontend Architecture

```
public/  index.html  manifest.json  sw.js  icons/
src/
  data/          supabaseClient.js   auth.js       catalogos.js
                 prendas.js  outfits.js  tips.js  links.js  search.js
  domain/        validation.js  mappers.js  format.js
  ui/            router.js  session-gate.js  transitions.js
    screens/     login.js
                 prendas-list.js  prenda-detail.js  prenda-form.js
                 outfits-list.js  outfit-detail.js  outfit-form.js
                 tips-list.js     tip-form.js       search.js
    components/  card.js  chip.js  color-swatch.js  empty-state.js  toast.js
  app.js
tests/unit/  tests/rls/
```

**Layer rules.** `src/data/` is the only place that imports `@supabase/supabase-js`. Every module there takes the client by injection (`export function makePrendasRepo(client)`), which is what makes it unit-testable with a fake query builder and no network. `src/ui/` imports `data` and `domain` but never the SDK. `src/domain/` imports nothing.

**What is left client-side.** Derivation is gone — `estado`, `nombre_sugerido` and `disponible` come from Postgres and the UI refetches after mutations. `src/domain/` therefore holds only: (1) `validation.js` — form rules mirrored from DB constraints for fast feedback (1–3 colores, required `nombre`/`titulo`/`fecha_ingreso`, `cantidad > 0`, `precio >= 0`, URL shape); (2) `mappers.js` — DB row → view model (flatten `tipo_prenda`, resolve `color[]` to `{nombre, hex}` via the cached `colores` catalog); (3) `format.js` — currency, dates, list joining. All three are pure functions and the easiest possible RED tests.

**Auth and session gating.**

```
app.js boot
  └─> data/auth.getSession()
        ├─ null    ──> ui/screens/login.js  (email + password only)
        └─ session ──> ui/router.start()
  data/auth.onAuthStateChange(cb)
        ├─ SIGNED_IN     ──> router.navigate(last intended route ?? '/prendas')
        └─ SIGNED_OUT /
           TOKEN_REFRESH_FAILED ──> router.reset(); render login
```

`createClient` uses `{ auth: { persistSession: true, autoRefreshToken: true, storage: localStorage } }`, so a reload restores the session without re-login. `ui/session-gate.js` wraps the router: any route other than `/login` checks for a live session and otherwise records the intended route and renders login. Data modules never check auth — a 401/RLS-empty result surfaces as an error the gate handles. Stated plainly in code comments: **the gate is UX, RLS is security.**

## Data Flow

```
  ui/screens/*  ──uses──>  domain/*  (pure: validate, map, format)
        │
        │ calls
        ▼
     data/*  ──single supabase client──>  Supabase (PostgREST)
                                              │
                                       RLS: user_id = auth.uid()
                                              ▼
                          prenda / outfit / tip / join tables
                          outfit_v (security_invoker) · search_all() RPC

  mutation ──> data.link() ──> refetch outfit_v row ──> ui re-render (GSAP)
```

## Interfaces / Contracts

```js
// src/data/prendas.js — every repo follows this shape
export function makePrendasRepo(client) {
  return {
    list({ categoria, disponible, favorito, temporada } = {}),  // -> Prenda[]
    getById(id),                     // -> { prenda, outfits, tips }  (3 queries)
    create(input), update(id, patch), remove(id),
  };
}

// src/data/links.js
export function makeLinksRepo(client) {
  return { linkOutfitPrenda(outfitId, prendaId), unlinkOutfitPrenda(o, p),
           linkPrendaTip(p, t), unlinkPrendaTip(p, t),
           linkOutfitTip(o, t),  unlinkOutfitTip(o, t) };
}

// src/data/search.js  -> client.rpc('search_all', { q })
// SearchHit = { tipo: 'prenda'|'outfit'|'tip', id, titulo, subtitulo }
// UI groups by `tipo`; the RPC never has to know about grouping.

// src/data/auth.js
export function makeAuth(client) {
  return { signIn(email, password), signOut(), getSession(), onAuthStateChange(cb) };
}
```

```sql
create function search_all(q text)
returns table (tipo text, id uuid, titulo text, subtitulo text)
language sql stable
security invoker            -- explicit: RLS must apply to the caller
as $$
  select 'prenda', p.id, p.nombre, coalesce(p.marca,'') from prenda p
    where p.nombre ilike '%'||q||'%' or p.marca ilike '%'||q||'%'
  union all
  select 'outfit', o.id, o.titulo, coalesce(o.notas,'') from outfit o
    where o.titulo ilike '%'||q||'%' or o.notas ilike '%'||q||'%'
  union all
  select 'tip', t.id, t.tip, coalesce(t.descripcion,'') from tip t
    where t.tip ilike '%'||q||'%' or t.descripcion ilike '%'||q||'%'
  limit 60;
$$;
```

## PWA Shell

`public/manifest.json`: `name: "Closet"`, `short_name: "Closet"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `orientation: "portrait"`, `background_color`/`theme_color` as neutral placeholders pending the later visual-design change, `icons`: 192 and 512 PNG plus one `purpose: "maskable"` 512.

`public/sw.js` — app shell only, no data caching:

| Request | Strategy |
|---|---|
| `install` | precache `SHELL = ['/', '/index.html', '/app.css', '/src/app.js', manifest, icons]` into `closet-shell-v1` |
| `activate` | delete every cache whose name is not the current version; `clients.claim()` |
| Same-origin navigation | cache-first on `/index.html`, network in background |
| Same-origin static asset | cache-first, fall back to network |
| Anything not same-origin (incl. `*.supabase.co`) | **not intercepted** — `return;` before `respondWith` |

The cross-origin bypass is deliberate and load-bearing: intercepting Supabase traffic would cache authenticated rows and bearer tokens in the Cache API, which is both an offline-data feature that is out of scope and a security regression. Cache-name versioning is the only invalidation mechanism; bumping `v1` is part of any shell change.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit | `src/domain/*` — validation rules, row→view-model mapping, formatting | Pure functions, Vitest, no mocks. RED-first, cheapest tests in the codebase. |
| Unit | `src/data/*` — filter/query construction, error mapping, link/unlink payloads, `search_all` argument shape | Inject a fake Supabase client (chainable stub recording `.from().select().eq()...`); assert calls and returned shapes. No network. |
| Unit | `sw.js` routing predicate (which requests get intercepted) | Extract the decision to a pure `shouldHandle(request)` and test it directly, including that a `*.supabase.co` URL returns `false`. |
| Integration | **RLS per table per operation** | `tests/rls/` against a local Supabase (`supabase start`). Two clients from the same anon key: one anonymous, one `signInWithPassword`. For each of the 8 tables assert anon SELECT returns 0 rows and anon INSERT/UPDATE/DELETE errors; assert the authenticated owner succeeds on its own rows. Also assert `outfit_v` and `search_all` return 0 rows anonymously — the two `security_invoker` footguns. |
| Integration | Derived values | Insert an outfit with 0 / all-`En closet` / mixed garments; assert `outfit_v.estado` is `Sin prendas` / `Disponible` / `Incompleto` and `nombre_sugerido` is distinct-and-`orden`-ordered. Assert a direct write to `prenda.disponible` is rejected. |
| Integration | Composite-FK guard | Attempt to link entity rows owned by two different users; assert the FK rejects it. Needs a second seeded test user (test fixture only). |
| Manual / later E2E | PWA install prompt, shell boots with network offline, GSAP transitions | Manual for this change; Playwright once routes stabilize (per `openspec/config.yaml` testing block). |

**Strict-TDD ordering.** Task 1 scaffolds `package.json` + `vitest.config.js` before any other file (no runner exists today). The RLS suite is genuinely RED-able: write the anon-denial assertions against a migration that has created the tables but not yet enabled RLS — anon reads rows, the test fails — then add `enable row level security` + policies to turn it green. That makes the security posture test-driven rather than asserted after the fact.

`npx vitest run` must stay green without a running database, so the RLS/integration suite lives in a separate Vitest project (`tests/rls`) invoked explicitly and skipped when `SUPABASE_URL` for the local stack is absent.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is introduced. The security boundary in this change is database authorization (RLS), covered explicitly in the RLS policy table and the integration testing rows above rather than by the routing/shell matrix.

## Migration / Rollout

Greenfield; no data migration. Migrations are ordered and each ships a paired `down`:

1. `0001_types_and_lookups` — enums, `colores` (+ seed), `tipo_prenda` (+ seed).
2. `0002_entities` — `prenda`, `outfit`, `tip`, indexes, unique `(id, user_id)`.
3. `0003_joins` — three join tables with composite FKs.
4. `0004_rls` — `enable row level security` + policies on all 8 tables.
5. `0005_views_and_search` — `outfit_v` (`security_invoker`), `search_all()`.

`down` order reverses: functions/views → policies → join tables → entities → lookups → types. Rollback of frontend code is a branch revert. Storage buckets for `fotos` are created manually and deleted manually if abandoned.

## Open Questions

- [ ] Seed vocabulary for `tipo_prenda` — the exploration lists ~20 values; confirm the initial seed set (the table is user-extensible, so this is low-stakes and can be done at apply time).
- [ ] `talla` stays free text for now; if size filtering is ever wanted it becomes a lookup table per `categoria`. Not needed for this slice.
- [ ] Supabase Storage bucket policy for `fotos` — must also be owner-scoped (path-prefixed by `auth.uid()`); the bucket RLS is adjacent to this change but only strictly needed once photo upload UI ships. Flag for `sdd-tasks` to decide whether it lands here or in the next change.
