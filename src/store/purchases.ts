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
  simulateVipActivation: () => Promise<void>;
}

export const usePurchasesStore = create<PurchaseState>((set, get) => ({
  isVip: false,
  vipUntil: null,
  loading: false,

  checkVipStatus: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Check user table is_vip, vip_until, and trial_ends_at
    const now = new Date();
    const isVipUser = user.is_vip && user.vip_until ? new Date(user.vip_until) > now : false;
    const isTrialActive = user.trial_ends_at ? new Date(user.trial_ends_at) > now : false;

    if (isVipUser || isTrialActive) {
      set({ isVip: true, vipUntil: user.vip_until || user.trial_ends_at });
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
      if (error) throw error;
      
      return { 
        error: null, 
        snapToken: data?.snap_token, 
        redirectUrl: data?.redirect_url 
      };
    } catch (err) {
      console.warn('Failed calling create-subscription edge function, returning mock payment:', err);
      set({ loading: false });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock payment redirect
      return {
        error: null,
        snapToken: 'mock-snap-token-123',
        redirectUrl: '#mock-payment-modal'
      };
    }
  },

  simulateVipActivation: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1); // 1 month VIP
    const futureDateStr = futureDate.toISOString();

    const patch = {
      is_vip: true,
      vip_until: futureDateStr
    };

    // Update locally & cloud user table
    await useAuthStore.getState().updateProfile(patch);
    set({ isVip: true, vipUntil: futureDateStr, loading: false });
  }
}));
