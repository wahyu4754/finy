import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl } from './supabase-config';

/**
 * Service-role Supabase client for the admin CMS.
 *
 * This key bypasses every RLS policy, so it can read and write ANY user's rows.
 * It must never reach the browser. The window guard below fails loudly at import
 * time rather than silently shipping the key in a client bundle.
 *
 * Route handlers and server components only.
 */
if (typeof window !== 'undefined') {
  throw new Error(
    '[supabase-admin] This module creates a service-role client and was imported ' +
      'into a browser bundle. Only import it from Route Handlers, Server Actions, ' +
      'or Server Components.'
  );
}

const PLACEHOLDER_MARKERS = ['your-', 'xxxx', 'placeholder'];

let cached: SupabaseClient | null = null;

/**
 * Distinct from an authorization failure so the CMS can tell "you are not an
 * admin" apart from "the server is not configured" — the second must show setup
 * instructions, not a misleading access-denied screen.
 */
export class ServiceKeyMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceKeyMissingError';
  }
}

function readServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!key || PLACEHOLDER_MARKERS.some(m => key.toLowerCase().includes(m))) {
    throw new ServiceKeyMissingError(
      'SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder. ' +
        'Get it from Supabase → Project Settings → API → service_role (secret) key, ' +
        'then add it to .env.local and to Vercel → Settings → Environment Variables. ' +
        'Do NOT prefix it with NEXT_PUBLIC_.'
    );
  }

  return key;
}

export function getAdminClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(supabaseUrl, readServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
