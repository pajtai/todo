# sites.soliddigital.com

## Dev Workflow
- Always git commit updates after changes unless instructed otherwise.
- Break large changes into multiple smaller commits grouped by related changes.
- Always update documentation in @docs/ directory if relevant.
- Add documentation to @docs/ if relevant and link from the list below.
- When dealing with log files prefer tail -f over cat.

## Detailed docs

- [Local development](docs/local-development.md) — running the app against hosted Supabase, DB scripts, migrations, Supabase client helpers
- [Auth](docs/auth.md) — sign-up and login flow, hosted auth settings, protecting pages, Cache Components rules, RLS convention
- [Data model](docs/data-model.md) — tables and columns, area hierarchy and archiving rules, sample data, how database tests work
- [Review](docs/review.md) — `review_completed` RPC, periods and timezones, roll-up grouping, URL params

## Next.js
@AGENTS.md
