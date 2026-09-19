import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';

interface Subscription {
  id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled' | 'failed';
  plan: 'monthly' | 'annual';
  expires_at: string;
}

interface PurchaseState {
  isVip: boolean;
  vipUntil: string | null;
  loading: boolean;
  
  checkVipStatus: () => Promise<void>;
  createSubscription: (plan: 'monthly' | 'annual') => Promise<{ error: any; snapToken?: string; redirectUrl?: string }>;
}

export const usePurchasesStore = create<PurchaseState>((set, get) => ({
  isVip: false,
  vipUntil: null,
  loading: false,

  checkVipStatus: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const now = new Date();

    // Check user table is_vip directly
    if (user.is_vip) {
      set({ isVip: true, vipUntil: user.vip_until });
      return;
    }

    // Check subscription table directly
    set({ loading: true });
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const sub = data[0] as Subscription;
      const expDate = new Date(sub.expires_at);
      if (expDate > now) {
        set({ isVip: true, vipUntil: sub.expires_at, loading: false });
        return;
      }
    }
    
    set({ isVip: false, vipUntil: null, loading: false });
  },

  createSubscription: async (plan) => {
    set({ loading: true });
    
    try {
      // Call Supabase Edge Function 'create-subscription'
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { plan }
      });

      set({ loading: false });
      if (error) {
        let msg = error.message;
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          }
        } catch (_) {}
        throw new Error(msg || 'Gagal memproses transaksi.');
      }
      
      return { 
        error: null, 
        snapToken: data?.snap_token, 
        redirectUrl: data?.redirect_url 
      };
    } catch (err: any) {
      console.error('Failed calling create-subscription edge function:', err);
      set({ loading: false });
      return { 
        error: err?.message || 'Gagal memproses transaksi. Silakan coba lagi.', 
        snapToken: undefined, 
        redirectUrl: undefined 
      };
    }
  }
}));
