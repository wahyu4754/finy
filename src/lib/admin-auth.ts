import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseUrl, supabaseAnonKey } from './supabase-config';
import { getAdminClient, ServiceKeyMissingError } from './supabase-admin';

/**
 * Admin authorization gate for the CMS.
 *
 * SERVER ONLY — this imports the service-role client, so it must never be
 * imported from middleware.ts (edge bundle) or any Client Component.
 *
 * The check is deliberately two-step and never trusts a client-supplied claim:
 *   1. getUser() validates the session cookie against Supabase (a cookie is
 *      trivially forgeable; the round-trip is not).
 *   2. is_admin is then read from public.users with the service-role client, so
 *      the answer cannot be hidden by an RLS policy and cannot be spoofed by
 *      editing localStorage or a JWT claim.
 */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export class AdminAuthError extends Error {
  constructor(
    readonly status: 401 | 403 | 500,
    message: string
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

async function getSessionUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: cookiesToSet => {
        // Writes the refreshed access token back onto the request cookies.
        // Wrapped because Server Components cannot mutate cookies — there,
        // middleware.ts already handles the refresh.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* read-only context; middleware refreshes instead */
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error) throw new AdminAuthError(500, `Session validation failed: ${error.message}`);
  return data.user;
}

/**
 * Resolve the signed-in admin, or null when the caller is not one.
 * Use this in layouts/pages that render a "no access" screen instead of a 401.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const authUser = await getSessionUser();
    if (!authUser) return null;

    const { data: profile, error } = await getAdminClient()
      .from('users')
      .select('id, email, name, is_admin, is_banned')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('[admin-auth] failed to read admin profile:', error.message);
      return null;
    }

    if (!profile?.is_admin || profile.is_banned) return null;

    return {
      id: profile.id,
      email: profile.email || authUser.email || '',
      name: profile.name || authUser.email?.split('@')[0] || 'Admin',
    };
  } catch (err) {
    if (err instanceof AdminAuthError) throw err;
    // A configuration problem is not an authorization answer. Surfacing it lets
    // the layout render setup instructions instead of "Access denied".
    if (err instanceof ServiceKeyMissingError) throw err;
    console.error('[admin-auth] unexpected error:', err);
    return null;
  }
}

/** Resolve the signed-in admin or throw. Use this in every API Route Handler. */
export async function requireAdmin(): Promise<AdminUser> {
  const authUser = await getSessionUser();
  if (!authUser) throw new AdminAuthError(401, 'Not authenticated');

  const { data: profile, error } = await getAdminClient()
    .from('users')
    .select('id, email, name, is_admin, is_banned')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw new AdminAuthError(500, `Admin lookup failed: ${error.message}`);
  if (!profile) throw new AdminAuthError(403, 'No profile row for this account');
  if (profile.is_banned) throw new AdminAuthError(403, 'Account is suspended');
  if (!profile.is_admin) throw new AdminAuthError(403, 'Admin access required');

  return {
    id: profile.id,
    email: profile.email || authUser.email || '',
    name: profile.name || authUser.email?.split('@')[0] || 'Admin',
  };
}

/** Turn a requireAdmin() failure into the matching HTTP response. */
export function adminErrorResponse(err: unknown): NextResponse {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // The message is setup instructions, not a secret, so it is safe to return.
  if (err instanceof ServiceKeyMissingError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error('[admin-auth] unhandled error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
