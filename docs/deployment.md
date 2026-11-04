# Deployment

The app runs on **Vercel** (team `todo-9e5b`, project `todo`) against the hosted Supabase project `ikskdeuslqfakakhlmra`. That same project is used for local development, so **dev and production share one database**. Anything you create while developing locally is real production data. A separate production project can be added later; see the end of this page.

- Production: https://todo-mu-beige-67.vercel.app
- Previews: `https://<deployment>-todo-9e5b.vercel.app`

## Shipping changes

```sh
npm run db:push        # apply new migrations first; the deployed code expects them
npm run db:types       # if the schema changed
vercel --prod          # build and deploy to production
vercel                 # or: a preview deployment
```

Push migrations **before** deploying code that uses them, and keep migrations backwards compatible with the currently deployed code, because there's a window where old code runs against the new schema.

Never put demo or seed data into the database (`supabase/seed.sql` isn't used). `db push` doesn't run seeds.

The GitHub repo isn't connected for auto-deploys yet: connecting failed because the Vercel account has no GitHub login connection. To set it up, add GitHub under Vercel → Account Settings → Authentication, then run `vercel git connect`.

## Environment variables

Set for **Production** and **Preview** with `vercel env add <name> <environment>`:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ikskdeuslqfakakhlmra.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key (Dashboard → Project Settings → API Keys) |

`NEXT_PUBLIC_` values are inlined at build time, so redeploy after changing them. `vercel env pull` writes them to a local file.

## Auth URL configuration

In Supabase → Authentication → URL Configuration, or through the Management API (`PATCH /v1/projects/{ref}/config/auth`):

- **Site URL:** `https://todo-mu-beige-67.vercel.app`. Supabase falls back to it when a redirect isn't allowed, and email templates use it.
- **Redirect URLs:**
  - `http://localhost:3000/auth/confirm` (local dev)
  - `https://todo-mu-beige-67.vercel.app/auth/confirm`
  - `https://*-todo-9e5b.vercel.app/**` (every preview deployment)

Sign-up sends `emailRedirectTo = <current origin>/auth/confirm`. If that origin isn't allowed, the confirmation link goes to the Site URL instead, and the user confirms there.

Don't use `supabase config push` for this: it overwrites all hosted auth settings with `supabase/config.toml`.

Add any custom domain to both lists.

## Email

Auth emails use Supabase's default sender. It **only delivers to members of the Supabase organization** and has a low hourly limit, so sign-ups from anyone else won't get a confirmation email. Before opening sign-up, configure custom SMTP (for example Resend or Postmark) under Authentication → Emails → SMTP Settings, and raise the email rate limit.

## Preview deployments

Vercel Deployment Protection is on, so previews require signing in to Vercel. Sign-in inside a preview works because of the wildcard redirect URL. Previews use the same database as production.

## Security checks

Supabase → Advisors → Security should show no warnings except:

- **Leaked password protection** (an Auth setting) is off. Turn it on under Authentication → Providers → Email if the plan supports it.

Every public table has RLS enabled (see [auth.md](auth.md)). The project also has an `ensure_rls` event trigger (`public.rls_auto_enable()`, created by Supabase) that enables RLS on new public tables. A migration revokes API access to that function.

## Adding a separate production project later

1. Create the project, then `npx supabase link --project-ref <new-ref>` and `npm run db:push` to apply every migration.
2. Repeat the auth URL settings and SMTP on the new project.
3. Point the Vercel Production env vars at it and redeploy. Leave Preview on the dev project.
4. Relink the CLI to the dev project for day-to-day work.
