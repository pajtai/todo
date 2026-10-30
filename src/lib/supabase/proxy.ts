import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const AUTH_PAGES = ["/login", "/signup"];

// Refreshes the Supabase auth session on every request, writes updated cookies
// to both the request (for Server Components) and the response, and redirects
// based on whether a session exists. This is an optimistic check for fast
// redirects; getCurrentUser() and RLS are what actually protect data.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it triggers
  // the token refresh, and skipping it can randomly log users out.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isAuthRoute = pathname.startsWith("/auth/");

  if (!signedIn && !isAuthPage && !isAuthRoute) {
    return redirectTo(request, response, "/login");
  }
  if (signedIn && isAuthPage) {
    return redirectTo(request, response, "/todos");
  }

  return response;
}

// Carries over any refreshed session cookies, which a bare redirect would drop.
function redirectTo(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies
    .getAll()
    .forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
