import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  initialized: boolean;
  streakJustIncreased: boolean;
  
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  claimTrial: () => Promise<void>;
  deleteAccount: () => Promise<{ error: any }>;
  updateProfile: (data: Partial<User>) => Promise<{ error: any }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  streakJustIncreased: false,

  initialize: async () => {
    // 1. Try to load cached profile from localStorage
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('finy_user_profile');
      if (cached) {
        try {
          set({ user: JSON.parse(cached) });
        } catch (e) {
          localStorage.removeItem('finy_user_profile');
        }
      }
    }

    const timeout = (ms: number) => new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Network timeout')), ms)
    );

    try {
      // 2. Fetch session from Supabase with 2s timeout
      const getSessionPromise = supabase.auth.getSession();
      const { data: { session } } = await Promise.race([getSessionPromise, timeout(2000)]) as any;
      set({ session, loading: !session });

      // 3. Listen to auth changes
      supabase.auth.onAuthStateChange(async (event: any, currentSession: any) => {
        set({ session: currentSession });
        
        if (currentSession?.user) {
          set({ loading: true });
          try {
            await Promise.race([get().fetchProfile(), timeout(2000)]);
          } catch (err) {}
          set({ loading: false });
        } else {
          set({ user: null, loading: false });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('finy_user_profile');
          }
        }
      });
    } catch (error) {
      console.warn('Supabase Auth init timed out or failed (running in offline/mock mode):', error);
    } finally {
      set({ initialized: true, loading: false });
    }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  signUp: async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('finy_user_profile');
    }
  },

  fetchProfile: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user details from public.users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        const userProfile: User = {
          id: data.id,
          email: data.email,
          name: data.name,
          is_vip: data.is_vip || false,
          trial_ends_at: data.trial_ends_at,
          vip_until: data.vip_until,
          ai_credits: data.ai_credits || 0,
          referred_by_code: data.referred_by_code,
          has_vip_voucher: data.has_vip_voucher || false,
          created_at: data.created_at,
        };
        
        set({ user: userProfile });
        if (typeof window !== 'undefined') {
          localStorage.setItem('finy_user_profile', JSON.stringify(userProfile));
        }
      } else {
        // Fallback if public profile doesn't exist yet
        const fallbackUser: User = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          is_vip: false,
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          vip_until: null,
          ai_credits: 5,
          has_vip_voucher: false,
          created_at: user.created_at || new Date().toISOString(),
        };
        set({ user: fallbackUser });
      }
    } catch (e) {
      console.warn('Failed to fetch user profile from Supabase:', e);
    }
  },

  claimTrial: async () => {
    const { session } = get();
    if (!session?.user) return;

    // Call public function or update locally
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.rpc('claim_trial'); // Matches DB RPC

    if (!error) {
      await get().fetchProfile();
    } else {
      // Direct local update if mock
      const updatedUser = get().user ? { ...get().user!, trial_ends_at: trialEnds } : null;
      set({ user: updatedUser });
      if (typeof window !== 'undefined' && updatedUser) {
        localStorage.setItem('finy_user_profile', JSON.stringify(updatedUser));
      }
    }
  },

  deleteAccount: async () => {
    const { error } = await supabase.functions.invoke('delete-account');
    if (!error) {
      await get().signOut();
    }
    return { error };
  },

  updateProfile: async (patch) => {
    const { user } = get();
    if (!user) return { error: 'Not logged in' };

    // Optimistic update
    const updated = { ...user, ...patch };
    set({ user: updated });
    if (typeof window !== 'undefined') {
      localStorage.setItem('finy_user_profile', JSON.stringify(updated));
    }

    const { error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', user.id);

    if (error) {
      // Revert if error
      await get().fetchProfile();
    }
    return { error };
  },
}));
