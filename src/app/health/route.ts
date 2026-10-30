import { createClient } from "@/lib/supabase/server";

// Temporary smoke test that env vars, the server client, and the hosted
// project work. getSession() alone doesn't hit the network without a session,
// so also call the Auth API. Removed in Phase 2.
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.auth.getSession();
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
    { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } },
  );
  if (!res.ok) {
    return Response.json(
      { ok: false, error: `Auth API returned ${res.status}` },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}
