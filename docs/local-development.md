# Local Development

The Next.js app runs locally against a **hosted Supabase project** (`todo`, ref `ikskdeuslqfakakhlmra`, `us-east-1`). We don't run the Supabase Docker stack locally because it's too heavy for the dev machine. The Supabase CLI is an npm dev dependency, so use `npx supabase` or the npm scripts below.

This single project currently holds all development data. Add a separate production project before real data matters.

## First-time setup

```sh
npm install
cp .env.example .env.local   # fill in from Dashboard → Project Settings → API Keys
npx supabase login
npx supabase link --project-ref ikskdeuslqfakakhlmra
npm run dev                  # http://localhost:3000
```

`.env.local` needs only the project URL and the publishable key. Never put the secret key in a `NEXT_PUBLIC_` variable.

## Database scripts

| Script | What it does |
| --- | --- |
| `npm run db:new <name>` | Create `supabase/migrations/<timestamp>_<name>.sql` |
| `npm run db:push` | Apply pending migrations to the hosted project |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the hosted schema |
| `npm run db:test` | Run the self-checking SQL tests in `supabase/tests/` against the hosted project (each rolls back) |

Run `db:new` from an interactive terminal; in a script it waits on stdin unless you add `</dev/null`.

`npx supabase db reset --linked` wipes the hosted database, so there is deliberately no script for it.

## Schema changes

Migrations in `supabase/migrations/` are the single source of truth for the schema. Never change the schema in Studio without capturing it in a migration.

```sh
npm run db:new <name>
# edit the file
npm run db:push
npm run db:types
```

### Every new table needs grants and RLS

The project was created with "Automatically expose new tables" **off**, so a table is unreachable through the Data API until a migration grants access. Each migration that creates a table must do both of these explicitly:

```sql
alter table public.things enable row level security;
grant select, insert, update, delete on public.things to authenticated;
-- plus policies
```

## Supabase clients

- `src/lib/supabase/server.ts` — `createClient()` for Server Components, Server Functions, and Route Handlers. Create one per request.
- `src/lib/supabase/client.ts` — `createClient()` for Client Components.
- `src/lib/supabase/proxy.ts` + `src/proxy.ts` — refreshes the auth session cookie on every request. (Next.js 16 renamed `middleware.ts` to `proxy.ts`.)
