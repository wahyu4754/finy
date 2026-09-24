import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RecurringRule, Transaction } from '../types';
import { useAuthStore } from './auth';
import { useTransactionStore } from './transactions';

/** How long an auto-posted transaction stays offerable for undo. */
const UNDO_WINDOW_DAYS = 3;
const DISMISS_KEY_PREFIX = 'finy_recurring_dismissed_';

interface RecurringState {
  rules: RecurringRule[];
  loading: boolean;
  /** Transactions the daily cron created, newest first, minus the dismissed ones. */
  autoPosted: Transaction[];

  fetchRules: () => Promise<void>;
  addRule: (rule: Omit<RecurringRule, 'id' | 'user_id' | 'created_at' | 'is_active'>) => Promise<{ error: any }>;
  updateRule: (id: string, rule: Partial<RecurringRule>) => Promise<{ error: any }>;
  deleteRule: (id: string) => Promise<{ error: any }>;
  toggleRule: (id: string, active: boolean) => Promise<{ error: any }>;

  fetchAutoPosted: () => Promise<void>;
  undoAutoPosted: (id: string) => Promise<{ error: any }>;
  dismissAutoPosted: (id: string) => void;
}

const dismissKey = (userId: string) => `${DISMISS_KEY_PREFIX}${userId}`;

function readDismissed(userId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(dismissKey(userId)) ?? '[]');
  } catch {
    return [];
  }
}

function writeDismissed(userId: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(dismissKey(userId), JSON.stringify(ids));
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
  rules: [],
  loading: false,
  autoPosted: [],

  fetchRules: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    set({ loading: true });

    const { data, error } = await supabase
      .from('recurring_rules')
      .select('*, category:categories(*), wallet:wallets(*)')
      .eq('user_id', userId)
      .order('next_due_date', { ascending: true });

    if (!error && data) {
      set({ rules: data as RecurringRule[], loading: false });
    } else {
      set({ rules: [], loading: false });
    }
  },

  addRule: async (rule) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const { error } = await supabase
      .from('recurring_rules')
      .insert([{ ...rule, user_id: userId, is_active: true }]);

    if (!error) await get().fetchRules();
    return { error };
  },

  updateRule: async (id, patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const { error } = await supabase
      .from('recurring_rules')
      .update(patch)
      .eq('id', id);

    if (!error) await get().fetchRules();
    return { error };
  },

  deleteRule: async (id) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const { error } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', id);

    if (!error) set({ rules: get().rules.filter((r) => r.id !== id) });
    return { error };
  },

  toggleRule: async (id, active) => {
    return get().updateRule(id, { is_active: active });
  },

  fetchAutoPosted: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const since = new Date(Date.now() - UNDO_WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(*), wallet:wallets(*)')
      .eq('user_id', userId)
      .not('recurring_rule_id', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      set({ autoPosted: [] });
      return;
    }

    const dismissed = new Set(readDismissed(userId));
    set({ autoPosted: (data as Transaction[]).filter((tx) => !dismissed.has(tx.id)) });
  },

  undoAutoPosted: async (id) => {
    const userId = useAuthStore.getState().user?.id;
    const { deleteTransaction, fetchWallets } = useTransactionStore.getState();

    // Deleting reverses the wallet balance through the migration 017 trigger, so
    // balances are re-read from the server rather than trusted from the optimistic
    // patch deleteTransaction applies (the row may not even be in the loaded month).
    const { error } = await deleteTransaction(id);
    if (error) return { error };

    set({ autoPosted: get().autoPosted.filter((tx) => tx.id !== id) });

    if (userId) writeDismissed(userId, [...readDismissed(userId), id]);
    await fetchWallets();

    return { error: null };
  },

  dismissAutoPosted: (id) => {
    const userId = useAuthStore.getState().user?.id;
    if (userId) writeDismissed(userId, [...readDismissed(userId), id]);
    set({ autoPosted: get().autoPosted.filter((tx) => tx.id !== id) });
  },
}));
