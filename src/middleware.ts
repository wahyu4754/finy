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
 * The client is created on every request, including public ones, so that a
 * refreshed access token is written back to the response cookies via setAll.
 * getUser() is used rather than getSession() because it validates the token
 * against Supabase instead of trusting a client-writable cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = PUBLIC_PATHS.some(p => pathname.startsWith(p));
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
  const hasSessionCookie = request.cookies
    .getAll()
    .some(c => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  const user = hasSessionCookie
    ? (await supabase.auth.getUser()).data.user
    : null;

  if (!isProtected) {
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-*.png|apple-touch-icon.png).*)'],
};
