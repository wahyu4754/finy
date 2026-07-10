import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Budget } from '../types';
import { useAuthStore } from './auth';

interface BudgetState {
  budgets: Budget[];
  loading: boolean;
  
  fetchBudgets: (month: string) => Promise<void>;
  upsertBudget: (budget: Omit<Budget, 'id' | 'user_id'>) => Promise<{ error: any }>;
  deleteBudget: (id: string) => Promise<{ error: any }>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  loading: false,

  fetchBudgets: async (month) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    set({ loading: true });
    
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month);

    if (!error && data) {
      set({ budgets: data as Budget[], loading: false });
    } else {
      set({ budgets: [], loading: false });
    }
  },

  upsertBudget: async (budget) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    // Find if the budget exists in the local store
    const existing = get().budgets.find(b => 
      b.category_id === budget.category_id && 
      b.wallet_id === budget.wallet_id && 
      b.month === budget.month
    );

    const generatedId = crypto.randomUUID();
    const newBudget: Budget = {
      id: existing?.id || generatedId,
      user_id: userId,
      ...budget
    };

    // Optimistic local update
    let updatedBudgets = [...get().budgets];
    const existingIdx = get().budgets.findIndex(b => b.id === newBudget.id);
    if (existingIdx > -1) {
      updatedBudgets[existingIdx] = newBudget;
    } else {
      updatedBudgets.push(newBudget);
    }
    set({ budgets: updatedBudgets });

    // Try cloud write
    let dbError;
    if (existing) {
      // 1. If it exists in the store, update it by its primary key ID
      const { error } = await supabase
        .from('budgets')
        .update({ amount: budget.amount })
        .eq('id', existing.id);
      dbError = error;
    } else {
      // 2. Otherwise, check database directly to handle any offline/race conditions
      let query = supabase
        .from('budgets')
        .select('id')
        .eq('user_id', userId)
        .eq('month', budget.month);

      if (budget.category_id === null) {
        query = query.is('category_id', null);
      } else {
        query = query.eq('category_id', budget.category_id);
      }

      if (budget.wallet_id === null) {
        query = query.is('wallet_id', null);
      } else {
        query = query.eq('wallet_id', budget.wallet_id);
      }

      const { data: dbExisting, error: fetchErr } = await query.maybeSingle();

      if (fetchErr) {
        dbError = fetchErr;
      } else if (dbExisting) {
        // Exists in DB, update by ID
        const { error } = await supabase
          .from('budgets')
          .update({ amount: budget.amount })
          .eq('id', dbExisting.id);
        dbError = error;
      } else {
        // Does not exist anywhere, insert new record
        const { error } = await supabase
          .from('budgets')
          .insert({
            id: generatedId,
            user_id: userId,
            category_id: budget.category_id,
            wallet_id: budget.wallet_id,
            amount: budget.amount,
            month: budget.month
          });
        dbError = error;
      }
    }

    if (dbError) {
      console.error('Failed to save budget in cloud:', dbError);
      // Revert on failure
      await get().fetchBudgets(budget.month);
    }

    return { error: dbError };
  },

  deleteBudget: async (id) => {
    const budget = get().budgets.find(b => b.id === id);
    const month = budget?.month;

    const updated = get().budgets.filter(b => b.id !== id);
    set({ budgets: updated });

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (error && month) {
      await get().fetchBudgets(month);
    }

    return { error };
  }
}));
