# closet-app

Closet catalog PWA (vanilla JS + GSAP) backed by Supabase (Postgres + Auth + Storage), no server tier for the core app.

## Production

- Supabase project: "OUTFIT" (`teffwexveqgrzzpsyoki`), same migrations as local, applied via the Supabase MCP tools.
- Hosting: Hostinger shared hosting. Hostinger's own Git deployment (Avanzado -> GIT) clones this repo into `public_html/repo` and pulls on every push to `master` via a webhook registered on this GitHub repo.
- `public_html/repo` is blocked from the web via a `.htaccess` (`Require all denied`) written by `~/sync-closet-app.sh`, which also copies `repo/public/*` and `repo/src/` into `public_html` (excluding `config.js`, which lives only on the server, never in git). That script runs on a cron job on the server, not in this repo.

## Prerequisites

- Node.js 18+ and npm
- [Docker](https://www.docker.com/) (required to run Supabase locally)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase` or via your package manager)
- [GitHub CLI](https://cli.github.com/) (`gh`) — used for auth and PRs

## 1. Clone and install

```bash
git clone https://github.com/naustdio/outfer.git closet-app
cd closet-app
npm install
```

## 2. Fix git credentials (if pushes get a 403)

If `git push` fails with a permission error even though you're logged into GitHub, your git credential helper is likely pointing at the wrong account:

```bash
gh auth login
gh auth setup-git
```

## 3. Start Supabase locally

The app runs entirely against a local Supabase stack — no shared/remote project needed for development.

```bash
supabase start
```

This spins up Postgres, Auth, Storage, and the API gateway in Docker. Custom ports are set in [`supabase/config.toml`](supabase/config.toml) (API on `56321`, DB on `56322`, Studio on `56323`) to avoid clashing with other local Supabase projects on your machine.

Apply the schema:

```bash
supabase db reset
```

This runs every migration in `supabase/migrations/` against the fresh local DB. **Warning:** it wipes local data — don't run it if you have test data you care about.

## 4. Configure local secrets

Two files are gitignored and must be created locally — copy from the tracked example and fill in values from `supabase start`'s output (it prints the anon key, service key, and Studio URL):

```bash
cp .env.local.example .env.local
```

`public/config.js` (used by the frontend at runtime) isn't tracked either — copy it from the committed template:

```bash
cp public/config.example.js public/config.js
```

The template defaults to a real/hosted Supabase project. For local dev against the Docker stack from step 3, edit `public/config.js` and point it at the local API instead, using the anon key printed by `supabase start`:

```js
window.__CLOSET_APP_CONFIG__ = {
  SUPABASE_URL: "http://127.0.0.1:56321",
  SUPABASE_ANON_KEY: "<anon key from `supabase start` output>",
};
```

## 5. Run the app

This is a vanilla ES-module PWA with no bundler — serve `public/` with any static file server:

```bash
npx serve public
```

Open the printed URL in your browser.

## 6. Run tests

```bash
npm test          # full suite
npm run test:unit # unit tests only
npm run test:rls  # RLS/security tests (needs the local Supabase stack running)
```

## Contributing from another machine

1. Follow steps 1–4 above on the new machine — each machine needs its own local Supabase stack and its own gitignored config files (they are never shared or committed).
2. Branch off `master`:
   ```bash
   git checkout master
   git pull origin master
   git checkout -b your-feature-branch
   ```
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, etc.), no AI attribution footers.
4. Push and open a PR against `master`:
   ```bash
   git push -u origin your-feature-branch
   gh pr create --base master
   ```
5. If your branch depends on another branch that hasn't merged yet, stack it instead of branching from `master`:
   ```bash
   gh pr create --base other-branch --head your-feature-branch
   ```
6. Before merging, make sure `npm test` passes locally — CI/verification is manual on this repo right now.

## Project structure

```
public/          Static frontend (HTML, CSS, entrypoint, service worker)
src/
  ui/            Router, screens, components
  data/          Supabase repositories (one per entity)
  domain/        Pure validation/mapping/formatting (no I/O)
src/app.js       App wiring (auth, nav, router)
src/main.js      Composition root
supabase/
  migrations/    Forward SQL migrations (numbered)
  migrations_down/  Manual rollback scripts (not auto-run by the CLI)
tests/
  unit/          Unit tests (domain + data, mocked client)
  rls/           Row-Level-Security integration tests (real local DB)
openspec/        Spec-Driven Development artifacts (proposals, specs, archive)
```
