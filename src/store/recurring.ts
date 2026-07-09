import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RecurringRule } from '../types';
import { useAuthStore } from './auth';
import { useTransactionStore } from './transactions';

interface RecurringState {
  rules: RecurringRule[];
  loading: boolean;
  
  fetchRules: () => Promise<void>;
  addRule: (rule: Omit<RecurringRule, 'id' | 'user_id' | 'created_at' | 'is_active'>) => Promise<{ error: any }>;
  updateRule: (id: string, rule: Partial<RecurringRule>) => Promise<{ error: any }>;
  deleteRule: (id: string) => Promise<{ error: any }>;
  toggleRule: (id: string, active: boolean) => Promise<{ error: any }>;
  processDueRules: () => Promise<void>;
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
  rules: [],
  loading: false,

  fetchRules: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    set({ loading: true });

    const { data, error } = await supabase
      .from('recurring_rules')
      .select('*, category:categories(*), wallet:wallets(*)')
      .eq('user_id', userId);

    if (!error && data) {
      set({ rules: data as RecurringRule[], loading: false });
      if (typeof window !== 'undefined') {
        localStorage.setItem(`finy_recurring_${userId}`, JSON.stringify(data));
      }
    } else {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`finy_recurring_${userId}`);
        if (cached) {
          try {
            set({ rules: JSON.parse(cached), loading: false });
            return;
          } catch (e) {}
        }
      }
      set({ rules: [], loading: false });
    }
  },

  addRule: async (rule) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const newRule: RecurringRule = {
      id: crypto.randomUUID(),
      user_id: userId,
      is_active: true,
      created_at: new Date().toISOString(),
      ...rule
    };

    const rules = [...get().rules, newRule];
    set({ rules });

    const { error } = await supabase
      .from('recurring_rules')
      .insert([newRule]);

    if (error) {
      await get().fetchRules();
    } else if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_recurring_${userId}`, JSON.stringify(rules));
    }

    return { error };
  },

  updateRule: async (id, patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const rules = get().rules.map(r => r.id === id ? { ...r, ...patch } : r);
    set({ rules });

    const { error } = await supabase
      .from('recurring_rules')
      .update(patch)
      .eq('id', id);

    if (error) {
      await get().fetchRules();
    } else if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_recurring_${userId}`, JSON.stringify(rules));
    }

    return { error };
  },

  deleteRule: async (id) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const rules = get().rules.filter(r => r.id !== id);
    set({ rules });

    const { error } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', id);

    if (error) {
      await get().fetchRules();
    } else if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_recurring_${userId}`, JSON.stringify(rules));
    }

    return { error };
  },

  toggleRule: async (id, active) => {
    return get().updateRule(id, { is_active: active });
  },

  processDueRules: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    // Fetch latest rules
    await get().fetchRules();

    const today = new Date().toISOString().split('T')[0];
    const dueRules = get().rules.filter(r => r.is_active && r.next_due_date <= today);

    if (dueRules.length === 0) return;

    const txStore = useTransactionStore.getState();

    for (const rule of dueRules) {
      // 1. Create transaction
      await txStore.addTransaction({
        wallet_id: rule.wallet_id || '',
        category_id: rule.category_id || '',
        amount: rule.amount,
        type: rule.type,
        note: rule.note || `Auto-recurring: ${rule.frequency}`,
        transaction_date: rule.next_due_date,
        is_recurring: true,
        recurring_period: rule.frequency,
        created_by_ai: false
      });

      // 2. Compute next due date
      const nextDue = new Date(rule.next_due_date);
      if (rule.frequency === 'daily') {
        nextDue.setDate(nextDue.getDate() + 1);
      } else if (rule.frequency === 'weekly') {
        nextDue.setDate(nextDue.getDate() + 7);
      } else if (rule.frequency === 'monthly') {
        nextDue.setMonth(nextDue.getMonth() + 1);
        if (rule.day_of_month) {
          // Adjust to match the preferred day of month (e.g. 28th)
          nextDue.setDate(Math.min(rule.day_of_month, 28));
        }
      }

      const nextDueStr = nextDue.toISOString().split('T')[0];
      await get().updateRule(rule.id, { next_due_date: nextDueStr });
    }
  }
}));
