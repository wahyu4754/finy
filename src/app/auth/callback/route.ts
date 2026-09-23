import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseUrl, supabaseAnonKey } from '../../../lib/supabase-config';

/**
 * OAuth / email-link landing route. Supabase redirects here with ?code=...;
 * exchanging it server-side is what sets the session cookie that middleware
 * reads, so the browser never has to win a client-side race to establish it.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Supabase redirects here with ?error=… instead of ?code=… when the provider
  // leg fails (e.g. "redirect_to not allowed"). Forward it so the failure is
  // visible instead of looking like a silent bounce back to the login page.
  const providerError =
    searchParams.get('error_description') || searchParams.get('error');

  const bounce = (reason: string) =>
    NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(reason)}`);

  if (providerError) {
    console.error('[auth/callback] provider returned an error:', providerError);
    return bounce(providerError);
  }

  if (!code) {
    console.error('[auth/callback] no ?code= in the redirect URL');
    return bounce('missing_code');
  }

  // cookies() is writable here because this is a Route Handler, not a Server Component.
  const cookieStore = await cookies();
  const responseHeaders = new Headers();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        // @supabase/ssr hands over Cache-Control: no-store with the first cookie
        // write. Dropping it lets a CDN cache a response that carries a session
        // token, which is how one user's session gets served to another.
        for (const [name, value] of Object.entries(headers)) {
          responseHeaders.set(name, value);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(
      '[auth/callback] exchangeCodeForSession failed:',
      error.name,
      error.message
    );
    return bounce(error.message || error.name);
  }

  return NextResponse.redirect(`${origin}/home`, {
    status: 307,
    headers: responseHeaders,
  });
}
