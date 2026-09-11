<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This repo ships a self-contained Cloud Agent environment (`.cursor/environment.json`) so it
runs without production Supabase credentials.

- **Local backend.** `scripts/dev/local-supabase.sh` runs a Supabase-compatible stack
  (PostgreSQL + PostgREST + an nginx `/rest/v1` gateway) and writes a local-only
  `.env.local` (gitignored). The `anon`/`service_role` keys are JWTs signed with Supabase's
  public demo secret — they are NOT production secrets. Demo tenant:
  `PUBLIC_RT_ID=00000000-0000-0000-0000-000000000007` ("RT 07"), seeded by
  `scripts/dev/schema.sql` (public landing page data only — not the full production schema).
- **Run the app.** Services start automatically via the environment `start` command; if a
  service is down, run `bash scripts/dev/local-supabase.sh up` (see also `status`, `down`,
  `psql`). The Next.js dev server runs in the `next-dev` terminal at
  `http://localhost:3000`.
- **Tests.** Security suites: `pnpm test:security:etalase|sensus|sesi|data-layer`. The
  `sensus` and `sesi` suites `import` `.ts` files, so they need Node >= 22.18 (native TS
  stripping). If the default `node` is older, select the newer one first, e.g.
  `nvm use 22.22.2`. Known baseline (not caused by the environment): `pnpm lint` has
  pre-existing errors, and `test:security:data-layer` has 3 pre-existing source-assertion
  failures.
