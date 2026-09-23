import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/auth/callback'];

/**
 * C-17: Lightweight auth gate.
 *
 * Checks for the Supabase auth session cookie. If absent on a protected
 * route, redirects to /sign-in before any React rendering occurs —
 * eliminating the authenticated-shell flash that the client-only guard
 * in AppShell could not prevent (M-29).
 *
 * The cookie-presence check is a fast-path heuristic; the authoritative
 * session validation still happens in AppShell's initialize() via
 * supabase.auth.getSession(). This middleware prevents unauthenticated
 * visitors from seeing even one frame of protected content.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const isProtected = !isAuthPage && pathname !== '/';

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('auth-token')) ||
    request.cookies.has('sb-hahjrdldqbxbzufzazbm-auth-token');

  if (!hasSession) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-*.png|apple-touch-icon.png).*)'],
};
