const PLACEHOLDER_KEY = 'your-placeholder-anon-key';

let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;

// Fallback to a valid default if empty
if (!url) {
  url = 'https://hahjrdldqbxbzufzazbm.supabase.co';
}

// Auto-prefix protocol if user omitted it in env
if (!url.startsWith('http://') && !url.startsWith('https://')) {
  url = `https://${url}`;
}

// NEXT_PUBLIC_* values are inlined at BUILD time, so a missing Vercel env var is
// invisible at runtime except here. The placeholder is kept (createServerClient
// throws on an empty key, which would 500 every route instead of only breaking
// auth), but every Supabase call fails with 401 while it is in use — which
// presents as a login redirect loop, not as a configuration error.
if (key === PLACEHOLDER_KEY) {
  console.error(
    '[supabase-config] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — falling back to a placeholder, ' +
      'so all auth and data requests will fail with 401. On Vercel set it under Project → Settings → ' +
      'Environment Variables and redeploy; locally add it to .env.local.'
  );
}

export const supabaseUrl = url;
export const supabaseAnonKey = key;
