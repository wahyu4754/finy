import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-placeholder-anon-key';

// Fallback to a valid default if empty
if (!supabaseUrl) {
  supabaseUrl = 'https://lihlutroaroqrmtlsnan.supabase.co';
}

// Auto-prefix protocol if user omitted it in env
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

export let supabase: any;

try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key) => typeof window !== 'undefined' ? localStorage.getItem(key) : null,
        setItem: (key, value) => { if (typeof window !== 'undefined') localStorage.setItem(key, value); },
        removeItem: (key) => { if (typeof window !== 'undefined') localStorage.removeItem(key); },
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
} catch (e) {
  console.warn('Failed to create Supabase client (using offline fallback mock):', e);
  
  // Dummy mock implementation to prevent application crash
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ error: { message: 'Offline Mode active' } }),
      signUp: async () => ({ error: { message: 'Offline Mode active' } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      update: () => Promise.resolve({ error: null }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  };
}
