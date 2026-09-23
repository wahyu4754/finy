import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseUrl, supabaseAnonKey } from './lib/supabase-config';

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/auth/callback'];

/**
 * C-17: Auth gate.
 *
 * The session lives in cookies (@supabase/ssr), so this can make a real
 * server-side auth decision before any React rendering occurs — eliminating
 * the authenticated-shell flash that the client-only guard in AppShell could
 * not prevent (M-29).
 *
 * The client is created on every request so a refreshed access token is written
 * back to the response cookies via setAll; public routes return before any
 * Supabase call, so only protected ones pay for the round-trip.
 * getUser() is used rather than getSession() because it validates the token
 * against Supabase instead of trusting a client-writable cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const isApi = pathname.startsWith('/api/');
  const isProtected = !isAuthPage && pathname !== '/';

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Auth-cookie responses must not be cacheable by a CDN, or one user's
        // session token can be served to another.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Cheap pre-filter only: the auth decision below is still made by getUser(),
  // which validates the token against Supabase rather than trusting a
  // client-writable cookie. Skipping the round-trip when no session cookie
  // exists keeps /sign-in and other public routes off the network.
  //
  // Anchored to `sb-<ref>-auth-token` and its `.0`/`.1` chunks on purpose: a
  // looser `includes('auth-token')` also matched the PKCE
  // `sb-<ref>-auth-token-code-verifier` cookie, so getUser() ran on the
  // /auth/callback request itself and — on a stale session — cleared cookies
  // right before the code exchange needed the verifier.
  const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;
  const hasSessionCookie = request.cookies
    .getAll()
    .some(c => SESSION_COOKIE.test(c.name));

  if (!isProtected) {
    return response;
  }

  const { data: { user }, error: userError } = hasSessionCookie
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };

  if (!user) {
    if (hasSessionCookie) {
      // A cookie was present but Supabase rejected it. Without this the loop
      // back to /sign-in is completely invisible in both browser and server
      // logs, and a transient fetch failure is indistinguishable from a
      // genuinely expired token.
      console.warn(
        `[middleware] rejected session cookie for ${pathname}: ` +
          `${userError ? `${userError.name}: ${userError.message}` : 'no user returned'} | ` +
          `cookies: ${request.cookies.getAll().map(c => c.name).join(', ')}`
      );
    }
    // API callers cannot follow a redirect to an HTML login page — a fetch
    // would silently receive markup and fail to parse.
    if (isApi) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // Suspension check. Enforced here rather than in the client stores because a
  // banned account must not be able to reach any page or API route, and because
  // leaving the session cookie in place would ping-pong the browser between
  // /home and /sign-in forever (AppShell sends an authenticated visitor away
  // from /sign-in). Fail open on a query error: a transient network problem
  // must not lock every user out of the app.
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('is_banned')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.warn(
      `[middleware] suspension check failed for ${user.id}: ${profileError.message}`
    );
  } else if (profile?.is_banned) {
    // signOut() clears the session cookies through setAll, which rebuilds
    // `response`. Carry those headers onto the reply so the browser actually
    // drops the cookie — otherwise the redirect loop described above returns.
    await supabase.auth.signOut();

    if (isApi) {
      return new NextResponse(JSON.stringify({ error: 'Account suspended' }), {
        status: 403,
        headers: response.headers,
      });
    }

    response.headers.set(
      'location',
      new URL('/sign-in?suspended=1', request.url).toString()
    );
    return new NextResponse(null, { status: 307, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-*.png|apple-touch-icon.png).*)'],
};
