# Plan: Todo App Foundation (scaffold, auth, todos, areas)

## Context
We are building a multi-user todo app. Beyond tracking todos and completion, its main purpose is to make it easy to **review completed todos and see which project, goal, habit, etc. each belongs to**.

Decisions already made:
- **Stack:** Next.js (App Router) + TypeScript + Tailwind, using `@supabase/ssr` for auth/session handling. Hosted on **Vercel**; backend is **Supabase** (Postgres + Auth). The app runs locally during development against a **hosted Supabase project** (ref `ikskdeuslqfakakhlmra`, `us-east-1`). The local Supabase Docker stack was dropped because it was too heavy for the dev machine.
- **Users:** multiple independent users. Open sign-up; every row is owned by a user and protected by Row Level Security (RLS) — users only ever see their own data.
- **Grouping model:** a single generic `areas` table with a `type` (`project`, `goal`, `habit`, `area`, `other`) and an optional `parent_id`, so e.g. a project can roll up to a goal. Todos link to **zero or more** areas through a `todo_areas` join table.
- **Habits:** habit-type areas will carry a simple recurrence rule and generate todo instances (handled in the second plan file).

Repo state at plan time: greenfield — only empty `README.md`, empty `.gitignore`, `CLAUDE.md`, and an empty `docs/` directory. Node v22.15.1, npm 10.9.2, Docker and the `vercel` CLI are installed; the Supabase CLI is **not** installed globally (use it as an npm dev dependency via `npx supabase`).

Project conventions (from `CLAUDE.md`): commit after changes in small grouped commits; keep `docs/` updated and link new docs from the "Detailed docs" list in `CLAUDE.md`.

**Hosted-database conventions (apply to every phase):** apply schema with `npm run db:new <name>`, `npm run db:push`, `npm run db:types`; never reset the hosted DB as routine. The project has "Automatically expose new tables" off, so every table's migration must explicitly `enable row level security` **and** `grant` privileges to `authenticated`. Older steps below that mention `db:reset` or the local mail catcher are superseded by this. Confirmation emails are real and rate-limited on the default sender. Database tests are self-checking SQL files that roll back, run with `npm run db:test`, instead of pgTAP (see `docs/data-model.md`).

**Cross-plan execution sequence:** this file contains Phases 1–4 and must be completed first. Then execute `plans/2026-10-29-todo-app-review-habits-deploy.md` (Phases 5–7) in order.

---

## Phase 1: Scaffold Next.js app and local Supabase
**Confidence: 90%**

### Description
Horizontal setup phase (unavoidable). Create the Next.js app in the repo root, add the Supabase CLI as a dev dependency, initialize `supabase/` config, and wire up Supabase client helpers so later phases can just import them. No app features yet.

Key outputs later phases rely on:
- `supabase/config.toml` and `supabase/migrations/` (migrations are the single source of truth for schema; never edit schema via Studio without capturing a migration).
- `src/lib/supabase/client.ts` (browser client via `createBrowserClient`), `src/lib/supabase/server.ts` (server client via `createServerClient` using `next/headers` cookies), and the session-refresh middleware (`src/middleware.ts`, or `src/proxy.ts` if the installed Next.js version has renamed middleware — check the version's docs).
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase dashboard; `.env.example` committed with placeholder values.
- npm scripts: `db:new`, `db:push`, `db:types` (`supabase gen types typescript --linked > src/lib/database.types.ts`).

### Testable End-State
The repo is linked to the hosted project. `npm run dev` serves http://localhost:3000, and a temporary `/health` server route calls the hosted Auth API and returns `{ ok: true }` — proving the env vars and server client work.

### References
- `CLAUDE.md` — commit/docs conventions
- `.gitignore` — currently empty; must be populated
- Supabase docs: "Setting up Server-Side Auth for Next.js" (`@supabase/ssr`) — canonical file layout for client/server/middleware helpers

### Implementation Steps
- [x] `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` (move existing `README.md`/`CLAUDE.md`/`docs/` aside if the generator refuses a non-empty dir, then restore)
- [x] `npm i @supabase/supabase-js @supabase/ssr` and `npm i -D supabase`
- [x] `npx supabase init`; `supabase link`; add npm scripts `db:new`, `db:push`, `db:types`
- [x] Create `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, and middleware session refresh helper
- [x] Create `.env.example`; ensure `.gitignore` covers `.env*.local`, `node_modules`, `.next`, `supabase/.branches`, `supabase/.temp`
- [x] Add temporary `src/app/health/route.ts`
- [x] Write `docs/local-development.md` (env setup, linking, migrations, type generation) and link it from `CLAUDE.md` "Detailed docs"; fill in `README.md` with a short overview pointing to docs
- [x] Commit (scaffold commit, then Supabase setup commit, then docs commit)

### Verification Steps
- [x] `npx supabase migration list --linked` connects to the hosted project
- [x] `curl http://localhost:3000/health` returns `{"ok":true}`
- [x] `npm run build` and `npm run lint` pass
- [x] `git status` shows no `.env.local` tracked

---

## Phase 2: Email/password auth and protected app shell
**Confidence: 85%**

### Description
Vertical slice for authentication. Assumes Phase 1 is complete (Supabase helpers in `src/lib/supabase/`, local stack running).

- Migration `supabase/migrations/<ts>_profiles.sql`: `profiles` table (`id uuid pk references auth.users on delete cascade`, `display_name text`, `timezone text not null default 'UTC'`, `created_at`), RLS enabled with select/update policies `id = auth.uid()`, and an `on auth.users insert` trigger (`security definer`) that creates the profile row. `timezone` is needed later (Phase 5/6) to group completions and habit occurrences by the user's local day.
- Pages: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx` using server actions in `src/app/(auth)/actions.ts` (`signUp`, `signIn`, `signOut`). Email confirmation: local config can keep confirmations on — confirmation emails land in the local mail catcher (Inbucket/Mailpit at http://127.0.0.1:54324). Add `src/app/auth/confirm/route.ts` to exchange the token.
- Protected route group `src/app/(app)/` with a layout that calls `supabase.auth.getUser()` and redirects to `/login` when absent; header shows the user email and a sign-out button. `/` redirects to `/todos` (placeholder page for now).
- On first load, capture browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and save it to `profiles.timezone` if still `'UTC'` default; editable later.
- Remove the temporary `/health` route.

### Testable End-State
Visit http://localhost:3000 → redirected to `/login`. Sign up with a new email → confirmation email appears in the local mail catcher → click link → land on `/todos` showing "Signed in as <email>". Sign out → back at `/login`; visiting `/todos` directly redirects to `/login`. In Studio, `profiles` has a row for the new user with the browser's timezone.

### References
- `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, middleware helper — from Phase 1
- `supabase/config.toml` — `[auth]` section (site_url, redirect URLs, email confirmations)
- `docs/local-development.md` — add mail catcher URL

### Implementation Steps
- [x] Write profiles migration (table, RLS, trigger); `npm run db:reset`; `npm run db:types`
- [x] Set `site_url`/`additional_redirect_urls` in `supabase/config.toml` for `http://localhost:3000`
- [x] Build login/signup pages + server actions + `/auth/confirm` route
- [x] Build `(app)` layout with auth guard, header, sign-out
- [x] Add timezone capture (small client component calling a server action)
- [x] Delete `/health` route
- [x] Write `docs/auth.md` (flow, local mail catcher, RLS convention: every user-owned table has `user_id uuid not null default auth.uid()` + policies `user_id = auth.uid()`); link from `CLAUDE.md`
- [x] Commit (migration, auth UI, docs)

### Verification Steps
- [x] Full sign-up → confirm → sign-in → sign-out flow works as described
- [x] Two different users can sign up; in SQL (`select * from profiles` as each user via Studio's "impersonate" or the REST API with each JWT) each sees only their own profile
- [x] Wrong password shows an error message, not a crash

---

## Phase 3: Todos CRUD and completion
**Confidence: 90%**

### Description
Vertical slice: create, list, edit, complete/uncomplete, and delete todos. Assumes Phase 2 is complete (auth guard in `src/app/(app)/layout.tsx`, `profiles` table, RLS convention in `docs/auth.md`).

- Migration `<ts>_todos.sql`: `todos` (`id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `title text not null check (length(title) between 1 and 500)`, `notes text`, `due_on date`, `completed_at timestamptz`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`), `updated_at` trigger, index on `(user_id, completed_at)`, RLS select/insert/update/delete policies on `user_id = auth.uid()`.
- **`completed_at` (not a boolean) is the key field for the review feature** — it records *when* something was done.
- UI at `src/app/(app)/todos/page.tsx` (server component listing open todos, then a collapsible "Completed today" section). Server actions in `src/app/(app)/todos/actions.ts`: `createTodo`, `updateTodo`, `toggleTodo` (sets/clears `completed_at = now()`), `deleteTodo`; `revalidatePath('/todos')` after each. Quick-add input at top; click a todo to edit title/notes/due date inline or in a small dialog.
- Add RLS tests with pgTAP in `supabase/tests/todos_rls.test.sql` (run via `npx supabase test db`) asserting user A cannot read/update/delete user B's todos.

### Testable End-State
Signed in, type "Buy milk" in quick-add and press Enter → it appears in the open list. Check it → it moves to "Completed today" and `completed_at` is set in Studio. Uncheck → back to open, `completed_at` null. Edit the title and due date → persists across reload. Delete → gone. A second user sees none of the first user's todos. `npx supabase test db` passes.

### References
- `src/app/(app)/layout.tsx` — auth guard from Phase 2
- `src/lib/database.types.ts` — regenerate after migration
- `docs/auth.md` — RLS convention

### Implementation Steps
- [x] Write todos migration; `npm run db:reset`; `npm run db:types`
- [x] Write pgTAP RLS test; add `db:test` npm script
- [x] Implement server actions and todos page (quick-add, list, toggle, edit, delete)
- [x] Write `docs/data-model.md` describing `profiles` and `todos` (to be extended in later phases); link from `CLAUDE.md`
- [x] Commit (migration + tests, UI, docs)

### Verification Steps
- [x] Manual flow above works end-to-end
- [x] `npm run db:test` passes
- [x] Empty/whitespace-only title is rejected with a visible message
- [x] Toggling quickly twice leaves a consistent state after reload

---

## Phase 4: Areas (projects, goals, habits…) and assigning todos to them
**Confidence: 80%**

### Description
Vertical slice for the grouping model. Assumes Phase 3 is complete (`todos` table and `/todos` page with server actions).

- Migration `<ts>_areas.sql`:
  - `create type area_type as enum ('project','goal','habit','area','other')`.
  - `areas` (`id`, `user_id default auth.uid()`, `name text not null`, `type area_type not null`, `parent_id uuid references areas on delete set null`, `color text`, `description text`, `archived_at timestamptz`, `created_at`, `updated_at`), unique `(user_id, lower(name), type)`.
  - Trigger preventing parent cycles (walk ancestors with a recursive CTE; raise if `new.id` found) and requiring `parent.user_id = new.user_id`.
  - `todo_areas` (`todo_id references todos on delete cascade`, `area_id references areas on delete cascade`, `user_id default auth.uid()`, pk `(todo_id, area_id)`), index on `area_id`.
  - RLS on both tables with the standard `user_id = auth.uid()` policies; `todo_areas` insert policy also checks that both the todo and the area belong to `auth.uid()`.
  - View or SQL function `area_ancestors(area_id)` / view `area_paths` (`area_id`, `ancestor_id`, `depth`) built with a recursive CTE, `security_invoker = true`. This is the foundation for roll-up in Phase 5.
- UI:
  - `src/app/(app)/areas/page.tsx`: list areas grouped by type, create/edit (name, type, parent picker, color), archive.
  - `src/app/(app)/areas/[id]/page.tsx`: area detail — its open and completed todos, and child areas.
  - On `/todos`: show area chips on each todo; a multi-select area picker when editing; filter by area via `?area=<id>`. Quick-add supports `#name` tokens to attach existing areas (nice-to-have; drop if it complicates things).
- Nav links: Todos, Areas.

### Testable End-State
Create a goal "Get fit", a project "Marathon training" with parent "Get fit", and a habit "Stretch". Edit todo "Run 5k" and attach "Marathon training" and "Stretch" → both chips appear. Open `/areas/<marathon id>` → "Run 5k" is listed. Try to set "Get fit"'s parent to "Marathon training" → error shown (cycle). `select * from area_paths` for the project returns itself (depth 0) and "Get fit" (depth 1).

### References
- `supabase/migrations/<ts>_todos.sql` — todos schema from Phase 3
- `src/app/(app)/todos/page.tsx`, `src/app/(app)/todos/actions.ts` — extend with area picker/filter
- `docs/data-model.md` — extend

### Implementation Steps
- [ ] Write areas migration (enum, tables, cycle trigger, RLS, `area_paths` view); reset DB; regenerate types
- [ ] Add pgTAP tests: cross-user `todo_areas` insert rejected; cycle rejected
- [ ] Build areas list/create/edit/archive UI and area detail page
- [ ] Add area chips, picker, and `?area=` filter to `/todos`
- [ ] Add seed data in `supabase/seed.sql` (a demo user is optional; at minimum document how to create sample areas) — useful for Phase 5 review testing
- [ ] Update `docs/data-model.md` with areas, `todo_areas`, `area_paths`, and the hierarchy rules
- [ ] Commit (migration + tests, areas UI, todo integration, docs)

### Verification Steps
- [ ] Manual flow above works
- [ ] `npm run db:test` passes including new tests
- [ ] Archiving an area hides it from pickers but keeps it on existing todos
- [ ] Deleting an area removes its chips from todos without deleting the todos

---
