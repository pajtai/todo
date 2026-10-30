# Plan: Todo App Review, Habits, and Deployment

## Context
We are building a multi-user todo app (Next.js App Router + TypeScript + Tailwind, Supabase Postgres/Auth via `@supabase/ssr`, hosted on Vercel, developed locally against the Supabase CLI Docker stack). Its main purpose, beyond tracking todos, is to make it **easy to review completed todos and see which project, goal, habit, etc. they belong to**.

This file covers the features that deliver that purpose (the Review view), habit recurrence, and production deployment.

**Cross-plan execution sequence:** execute `plans/2026-10-29-todo-app-foundation.md` Phases 1–4 first. Then execute this file's Phases 5 → 6 → 7 in order. Phase 7 (deploy) only depends on Phases 1–4 and can be pulled earlier if a hosted preview is wanted sooner.

What exists after the foundation plan:
- `profiles` (with `timezone`), `todos` (with `completed_at timestamptz`), `areas` (`type` enum: project/goal/habit/area/other, `parent_id` hierarchy), `todo_areas` join, and the `area_paths` view (`area_id`, `ancestor_id`, `depth`) — all RLS-protected by `user_id = auth.uid()`. Schema lives in `supabase/migrations/`, documented in `docs/data-model.md`.
- Supabase helpers in `src/lib/supabase/`, generated types in `src/lib/database.types.ts`, pages under `src/app/(app)/` (`todos`, `areas`, `areas/[id]`).
- pgTAP tests in `supabase/tests/` run by `npm run db:test`.

---

## Phase 5: Review view — completed todos by period, grouped by area
**Confidence: 75%**

### Description
The core feature. Assumes Phase 4 is complete (`areas`, `todo_areas`, `area_paths` exist and todos can be assigned to areas).

- Migration `<ts>_review.sql`: a `security invoker` SQL function `review_completed(p_from date, p_to date)` that, using the caller's `profiles.timezone`, returns completed todos whose local completion date is in `[p_from, p_to]`, with: `todo_id`, `title`, `completed_at`, `completed_local_date`, and a JSON array of directly attached areas plus their ancestors (from `area_paths`) with `id`, `name`, `type`, `depth`. Doing timezone conversion in SQL (`completed_at at time zone tz`) avoids off-by-one-day bugs in JS.
- Optional second function `review_summary(p_from, p_to)` returning counts per area **including roll-up** (a todo under "Marathon training" counts toward "Get fit" too) and an "Unassigned" bucket.
- UI `src/app/(app)/review/page.tsx` driven by search params so views are linkable:
  - Period selector: Today / This week / This month / Custom range (`?from=&to=`), with prev/next arrows.
  - Group-by toggle: **By area** (default; tree of goals → projects with completed todos underneath, counts with roll-up), **By type** (all projects, all goals, all habits…), **By day** (timeline, each todo showing its area chips/breadcrumb like "Get fit › Marathon training").
  - Filter by area type and by a specific area (`?area=`), including descendants.
  - Summary row at top: total completed, per-type counts.
- Add "Review" to nav; link area detail pages to `/review?area=<id>`.

Open uncertainty: the right shape of the RPC output vs. doing grouping in TS. Start with the flat `review_completed` function and group in TS; only add `review_summary` if TS grouping gets awkward.

### Testable End-State
Using seed data or manually created data: complete three todos today (one in "Marathon training", one in "Stretch", one unassigned) and backdate one completion to last week via Studio. Open `/review` → "This week" shows 3; By area shows "Get fit" (1, rolled up) › "Marathon training" (1), "Stretch" (1), "Unassigned" (1). Click prev-week arrow → the backdated todo appears. Switch to By day → todos listed under their local dates with area breadcrumbs. A todo completed at 11:30pm local time appears under that local day, not the UTC day.

### References
- `supabase/migrations/<ts>_areas.sql` — `area_paths` view used for roll-up
- `supabase/migrations/<ts>_profiles.sql` — `profiles.timezone`
- `src/app/(app)/areas/[id]/page.tsx` — add link into review
- `docs/data-model.md` — extend

### Implementation Steps
- [ ] Write `review_completed` function migration; reset DB; regenerate types
- [ ] pgTAP tests: timezone boundary case (completion at 23:30 local in a non-UTC zone), roll-up includes ancestors, other users' todos excluded
- [ ] Build `src/lib/review.ts` grouping helpers (by area tree with roll-up counts, by type, by day) with Vitest unit tests (add Vitest if not present)
- [ ] Build `/review` page with period selector, group-by toggle, filters, summary
- [ ] Add nav link and area-detail link
- [ ] Write `docs/review.md` (how periods/timezones/roll-up work); link from `CLAUDE.md`
- [ ] Commit (SQL + tests, grouping lib + tests, UI, docs)

### Verification Steps
- [ ] Manual scenario above produces the stated counts
- [ ] `npm run db:test` and `npx vitest run` pass
- [ ] Changing `profiles.timezone` shifts late-night completions to the correct day
- [ ] Empty period shows a friendly empty state

---

## Phase 6: Habit recurrence and streaks
**Confidence: 65%**

### Description
Assumes Phase 5 is complete. Habit-type areas get a recurrence rule and automatically produce a todo for each occurrence; completions feed the Review view and a streak indicator.

Approach — **lazy generation, no cron**: when the user loads `/todos` (or `/review`), call an RPC `ensure_habit_todos(p_through date)` that inserts any missing occurrence todos for active habits from `max(habit start, last generated)` up to today in the user's timezone. Idempotent via a unique index. This avoids needing Vercel Cron/pg_cron and works identically locally. (Confidence is lower because of edge cases: backfilling after long absences, editing a rule mid-stream, and whether missed past occurrences should be generated or skipped — default: generate only today's occurrence plus none in the past, and compute "missed" from the rule rather than from rows.)

- Migration `<ts>_habits.sql`:
  - Add to `areas`: `recurrence text check (recurrence in ('daily','weekly','weekdays'))`, `recurrence_days smallint[]` (0–6, used when `weekdays`), `habit_title text` (template for generated todo title, defaults to area name), `starts_on date`. Check constraint: recurrence columns only allowed when `type = 'habit'`.
  - Add to `todos`: `habit_area_id uuid references areas on delete set null`, `occurrence_date date`; unique index `(habit_area_id, occurrence_date)` where not null.
  - `ensure_habit_todos(p_through date)` (security invoker) inserts the todo and the matching `todo_areas` row.
  - `habit_streaks()` returning per-habit current streak and completion rate over last 30 days, computed from expected occurrences (`generate_series`) vs. completed habit todos.
- UI: recurrence fields on the area edit form when type is habit; habit todos show a ↻ icon on `/todos`; `/areas/[id]` for a habit shows a streak and a simple 30-day grid; Review "By type → Habits" shows completion rate for the period.

### Testable End-State
Create habit "Stretch" with recurrence daily starting today. Load `/todos` → "Stretch" todo for today appears exactly once (reload doesn't duplicate). Complete it → habit page shows streak 1; Review for today lists it under "Stretch". In Studio, insert completed occurrences for the previous 2 days → streak shows 3. A "weekdays [1,3,5]" habit only generates on Mon/Wed/Fri.

### References
- `supabase/migrations/<ts>_areas.sql` — `areas` table to extend
- `src/app/(app)/areas/` — area form and detail page
- `src/app/(app)/todos/page.tsx` — call `ensure_habit_todos` before listing
- `src/lib/review.ts` — add habit completion rate

### Implementation Steps
- [ ] Write habits migration (columns, constraints, unique index, `ensure_habit_todos`, `habit_streaks`); reset DB; regenerate types
- [ ] pgTAP tests: idempotency, weekday rule, timezone "today", streak calculation, cross-user isolation
- [ ] Add recurrence fields to area form; call `ensure_habit_todos` from `/todos` and `/review` server components
- [ ] Habit detail: streak + 30-day grid; habit icon on todos; completion rate in Review
- [ ] Update `docs/data-model.md` and add `docs/habits.md` (generation semantics, decisions on missed days); link from `CLAUDE.md`
- [ ] Commit (migration + tests, UI, docs)

### Verification Steps
- [ ] Manual scenario above works; reloading never creates duplicates
- [ ] `npm run db:test` passes
- [ ] Changing a habit's recurrence doesn't delete past completed occurrences
- [ ] Archiving a habit stops generation

---

## Phase 7: Deploy to Vercel with hosted Supabase
**Confidence: 80%**

### Description
Move from local-only to production. Depends only on Phases 1–4 being complete (can run any time after; re-run `db push` after later phases add migrations).

- Create a hosted Supabase project (user action in the Supabase dashboard — requires account access). `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push` to apply all migrations from `supabase/migrations/`.
- Configure hosted Auth: Site URL = production Vercel URL; redirect URLs include `https://<prod-domain>/auth/confirm` and the Vercel preview wildcard (`https://*-<team>.vercel.app/**`); configure SMTP or accept Supabase's rate-limited default sender for now.
- `vercel link`, then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key) for Production and Preview via `vercel env add`. Connect the GitHub repo for auto-deploys if desired (requires a remote; none exists at plan time).
- Never push `supabase/seed.sql` demo data to production.

### Testable End-State
Open the production URL → sign up with a real email → receive confirmation → sign in → create a todo, assign an area, complete it → it appears in `/review`. In the Supabase dashboard, the tables contain the new rows and RLS is enabled on every public table (Dashboard → Advisors shows no "RLS disabled" warnings).

### References
- `supabase/config.toml` — local auth settings to mirror in hosted project
- `.env.example` — required env var names
- `docs/local-development.md` — counterpart for local

### Implementation Steps
- [ ] User creates hosted Supabase project; link and `db push`
- [ ] Configure hosted Auth URLs (and SMTP if wanted)
- [ ] `vercel link`; add env vars for Production + Preview; `vercel --prod`
- [ ] Write `docs/deployment.md` (one-time setup, how to ship new migrations with `db push`, env vars, auth URL config); link from `CLAUDE.md`
- [ ] Commit docs

### Verification Steps
- [ ] Production end-to-end flow above works
- [ ] Supabase Advisors show no security warnings for RLS
- [ ] A Vercel preview deployment can complete sign-in (redirect URL wildcard works)

---
