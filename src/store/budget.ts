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

    // Unique budget key is (user_id, category_id, wallet_id, month)
    // Client UUID generation for offline support
    const newBudget: Budget = {
      id: crypto.randomUUID(),
      user_id: userId,
      ...budget
    };

    // Optimistic local update
    const existingIdx = get().budgets.findIndex(b => 
      b.category_id === budget.category_id && 
      b.wallet_id === budget.wallet_id && 
      b.month === budget.month
    );

    let updatedBudgets = [...get().budgets];
    if (existingIdx > -1) {
      updatedBudgets[existingIdx] = { ...updatedBudgets[existingIdx], amount: budget.amount };
    } else {
      updatedBudgets.push(newBudget);
    }
    set({ budgets: updatedBudgets });

    // Try cloud write
    const { error } = await supabase
      .from('budgets')
      .upsert({
        user_id: userId,
        category_id: budget.category_id,
        wallet_id: budget.wallet_id,
        amount: budget.amount,
        month: budget.month
      }, {
        onConflict: 'user_id,category_id,wallet_id,month'
      });

    if (error) {
      // Revert on failure
      await get().fetchBudgets(budget.month);
    }

    return { error };
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
