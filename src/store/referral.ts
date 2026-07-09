import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';

interface ReferralStats {
  code: string;
  total: number;
  subscribed: number;
  has_voucher: boolean;
  credits: number;
}

interface ReferralState {
  stats: ReferralStats | null;
  loading: boolean;

  fetchStats: () => Promise<void>;
  generateCode: () => Promise<void>;
  applyCode: (code: string) => Promise<{ error: any }>;
  redeemVoucher: () => Promise<{ error: any; vip_until: string | null }>;
}

export const useReferralStore = create<ReferralState>((set, get) => ({
  stats: null,
  loading: false,

  fetchStats: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    set({ loading: true });

    // Call Supabase RPC get_referral_stats()
    const { data, error } = await supabase.rpc('get_referral_stats');

    if (!error && data) {
      set({ stats: data as ReferralStats, loading: false });
    } else {
      // Mock / Offline mode fallback
      set({
        stats: {
          code: 'FINYWEB3',
          total: 2,
          subscribed: 1,
          has_voucher: false,
          credits: 10
        },
        loading: false
      });
    }
  },

  generateCode: async () => {
    set({ loading: true });
    const { data, error } = await supabase.rpc('get_or_create_referral_code');
    if (!error && data) {
      await get().fetchStats();
    }
    set({ loading: false });
  },

  applyCode: async (code) => {
    set({ loading: true });
    // Call Supabase RPC apply_referral_code(code)
    const { error } = await supabase.rpc('apply_referral_code', { p_code: code });
    if (!error) {
      await get().fetchStats();
      await useAuthStore.getState().fetchProfile();
    }
    set({ loading: false });
    return { error };
  },

  redeemVoucher: async () => {
    set({ loading: true });
    // Call Supabase RPC redeem_vip_voucher()
    const { data, error } = await supabase.rpc('redeem_vip_voucher');
    if (!error) {
      await get().fetchStats();
      await useAuthStore.getState().fetchProfile();
    }
    set({ loading: false });
    return { error, vip_until: data as string | null };
  }
}));
