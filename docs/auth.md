# Auth

Email/password auth through Supabase Auth, using `@supabase/ssr` session cookies.

## Flow

1. **Sign up** (`/signup`): the `signUp` action calls Supabase with `emailRedirectTo` set to `<origin>/auth/confirm`. A trigger on `auth.users` creates the `profiles` row.
2. **Confirm:** the emailed link goes through Supabase and lands on `/auth/confirm`, which exchanges the code for a session and redirects to `/todos`. Failures redirect to `/login?confirm=failed`. The code exchange needs a cookie set at sign-up, so a link opened in a different browser confirms the email but shows that notice; logging in then works.
3. **Log in / out:** the `signIn` and `signOut` actions in `src/app/(auth)/actions.ts`.
4. **Timezone:** when `profiles.timezone` is still the `UTC` default, `TimezoneSync` saves the browser's zone.

## Hosted configuration

Hosted auth settings live in the Supabase dashboard (Authentication → URL Configuration and Sign In / Providers). `supabase/config.toml` mirrors the intended values but isn't applied to the hosted project unless you run `supabase config push`, which overwrites hosted settings with the whole file, so review its diff first.

The Site URL is the production URL. The redirect allow-list covers `http://localhost:3000/auth/confirm`, production, and every Vercel preview. See [deployment.md](deployment.md#auth-url-configuration) for the exact values and the email sender limits.

## Protecting pages and data

There are three layers, and only the last two are security boundaries:

- **`src/lib/supabase/proxy.ts`** redirects signed-out requests to `/login` and signed-in visitors away from `/login` and `/signup`. It's an optimistic check for fast redirects. It reads the JWT without calling the Auth server.
- **`getCurrentUser()` in `src/lib/auth.ts`** validates the session with the Auth server and redirects if there is none. Call it in any page or action that needs the user. Don't rely on a layout as a guard: layouts don't re-run on navigation.
- **Row Level Security** enforces data access in Postgres, whatever the app code does.

## Cache Components

`cacheComponents` is on, so reading the session outside a `<Suspense>` boundary is a build error. Put anything that calls `getCurrentUser()` or the server `createClient()` in a component inside `<Suspense>`, as `UserMenu` does in `src/app/(app)/layout.tsx`. Don't put session reads in `"use cache"` functions.

## RLS convention

Every user-owned table has `user_id uuid not null default auth.uid() references auth.users on delete cascade`, and its migration does all of the following (see `docs/local-development.md` for why the grants are needed):

```sql
alter table public.things enable row level security;
revoke all on public.things from anon, public;
grant select, insert, update, delete on public.things to authenticated;
grant all on public.things to service_role;

create policy "Users can view their own things"
  on public.things for select to authenticated
  using ((select auth.uid()) = user_id);
-- likewise insert (with check), update (using + with check), and delete
```

`profiles` is the exception: its primary key `id` is the user id, and rows are created only by the trigger.

Functions that only triggers use should `revoke execute ... from public, anon, authenticated`, so they aren't callable through the API.
