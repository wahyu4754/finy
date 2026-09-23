let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-placeholder-anon-key';

// Fallback to a valid default if empty
if (!url) {
  url = 'https://hahjrdldqbxbzufzazbm.supabase.co';
}

// Auto-prefix protocol if user omitted it in env
if (!url.startsWith('http://') && !url.startsWith('https://')) {
  url = `https://${url}`;
}

export const supabaseUrl = url;
export const supabaseAnonKey = key;
