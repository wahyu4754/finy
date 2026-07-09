import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Transaction, Wallet, Category } from '../types';
import { useAuthStore } from './auth';

interface TransactionState {
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  loading: boolean;

  fetchTransactions: (month?: string) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: any; data: Transaction | null }>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<{ error: any }>;
  deleteTransaction: (id: string) => Promise<{ error: any }>;

  fetchWallets: () => Promise<void>;
  addWallet: (w: Omit<Wallet, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: any; data: Wallet | null }>;
  updateWallet: (id: string, w: Partial<Wallet>) => Promise<{ error: any }>;
  deleteWallet: (id: string) => Promise<{ error: any }>;

  fetchCategories: () => Promise<void>;
  addCategory: (cat: Omit<Category, 'id' | 'user_id'>) => Promise<{ error: any; data: Category | null }>;
  updateCategory: (id: string, cat: Partial<Category>) => Promise<{ error: any }>;
  deleteCategory: (id: string) => Promise<{ error: any }>;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-makan', user_id: null, name: 'Makan', icon: 'Utensils', color: '#F59E0B', type: 'expense', is_default: true },
  { id: 'cat-transport', user_id: null, name: 'Transport', icon: 'Car', color: '#3B82F6', type: 'expense', is_default: true },
  { id: 'cat-belanja', user_id: null, name: 'Belanja', icon: 'ShoppingBag', color: '#8B5CF6', type: 'expense', is_default: true },
  { id: 'cat-tagihan', user_id: null, name: 'Tagihan', icon: 'Receipt', color: '#06B6D4', type: 'expense', is_default: true },
  { id: 'cat-lainnya', user_id: null, name: 'Lainnya', icon: 'Package', color: '#6B7280', type: 'expense', is_default: true },
  { id: 'cat-gaji', user_id: null, name: 'Gaji', icon: 'Briefcase', color: '#10B981', type: 'income', is_default: true },
  { id: 'cat-bonus', user_id: null, name: 'Bonus', icon: 'Gift', color: '#C5F23C', type: 'income', is_default: true }
];

const DEFAULT_WALLETS = (userId: string): Wallet[] => [
  { id: 'wallet-dompet', user_id: userId, name: 'Dompet Tunai', type: 'cash', balance: 500000, is_default: true, created_at: new Date().toISOString() },
  { id: 'wallet-bank', user_id: userId, name: 'Rekening Bank', type: 'bank', balance: 2500000, is_default: false, created_at: new Date().toISOString() }
];

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  wallets: [],
  categories: DEFAULT_CATEGORIES,
  loading: false,

  fetchTransactions: async (month) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    set({ loading: true });
    
    // YYYY-MM date parsing for monthly query
    let query = supabase
      .from('transactions')
      .select('*, category:categories(*), wallet:wallets(*)')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false });

    if (month) {
      const startDate = `${month}-01`;
      // Find end date
      const year = parseInt(month.split('-')[0]);
      const nextMonth = parseInt(month.split('-')[1]);
      const endDate = `${year}-${nextMonth === 12 ? '01' : String(nextMonth + 1).padStart(2, '0')}-01`;
      
      query = query
        .gte('transaction_date', startDate)
        .lt('transaction_date', endDate);
    }

    const { data, error } = await query;

    if (!error && data) {
      set({ transactions: data as Transaction[], loading: false });
    } else {
      // Offline fallback: load mock transactions
      if (typeof window !== 'undefined') {
        const cachedTxs = localStorage.getItem(`finy_txs_${userId}`);
        if (cachedTxs) {
          try {
            set({ transactions: JSON.parse(cachedTxs), loading: false });
            return;
          } catch (e) {}
        }
      }
      set({ transactions: [], loading: false });
    }
  },

  addTransaction: async (tx) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in', data: null };

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: new Date().toISOString(),
      ...tx
    };

    // Update wallet balance locally/optimistically
    const wallets = get().wallets.map(w => {
      if (w.id === tx.wallet_id) {
        const delta = tx.type === 'expense' ? -tx.amount : tx.amount;
        return { ...w, balance: w.balance + delta };
      }
      return w;
    });
    set({ wallets });

    // Try cloud write
    const { data, error } = await supabase
      .from('transactions')
      .insert([newTx])
      .select('*, category:categories(*), wallet:wallets(*)')
      .single();

    // Also update wallet balance in Supabase database
    const targetWallet = wallets.find(w => w.id === tx.wallet_id);
    if (targetWallet) {
      await supabase
        .from('wallets')
        .update({ balance: targetWallet.balance })
        .eq('id', tx.wallet_id);
    }

    let savedTx = newTx;
    if (!error && data) {
      savedTx = data as Transaction;
    }

    // Update transactions list
    const transactions = [savedTx, ...get().transactions];
    set({ transactions });

    // Cache transactions locally
    if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_txs_${userId}`, JSON.stringify(transactions));
      localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(wallets));
    }

    return { error, data: savedTx };
  },

  updateTransaction: async (id, patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    // Reverse old transaction amount and apply new one
    const oldTx = get().transactions.find(t => t.id === id);
    let wallets = get().wallets;
    if (oldTx) {
      wallets = wallets.map(w => {
        // Reverse old
        let balance = w.balance;
        if (w.id === oldTx.wallet_id) {
          balance += oldTx.type === 'expense' ? oldTx.amount : -oldTx.amount;
        }
        // Apply new
        const newWalletId = patch.wallet_id || oldTx.wallet_id;
        const newAmount = patch.amount !== undefined ? patch.amount : oldTx.amount;
        const newType = patch.type || oldTx.type;
        if (w.id === newWalletId) {
          balance += newType === 'expense' ? -newAmount : newAmount;
        }
        return { ...w, balance };
      });
    }

    // Optimistic update
    const transactions = get().transactions.map(t => t.id === id ? { ...t, ...patch } : t);
    set({ transactions, wallets });

    const { error } = await supabase
      .from('transactions')
      .update(patch)
      .eq('id', id);

    // Also update wallet balance(s) in Supabase database
    if (oldTx) {
      const walletsToUpdate = [oldTx.wallet_id, patch.wallet_id || oldTx.wallet_id];
      for (const walletId of walletsToUpdate) {
        const targetWallet = wallets.find(w => w.id === walletId);
        if (targetWallet) {
          await supabase
            .from('wallets')
            .update({ balance: targetWallet.balance })
            .eq('id', walletId);
        }
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_txs_${userId}`, JSON.stringify(transactions));
      localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(wallets));
    }

    return { error };
  },

  deleteTransaction: async (id) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const oldTx = get().transactions.find(t => t.id === id);
    let wallets = get().wallets;
    if (oldTx) {
      wallets = wallets.map(w => {
        if (w.id === oldTx.wallet_id) {
          const delta = oldTx.type === 'expense' ? oldTx.amount : -oldTx.amount;
          return { ...w, balance: w.balance + delta };
        }
        return w;
      });
    }

    const transactions = get().transactions.filter(t => t.id !== id);
    set({ transactions, wallets });

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    // Also update wallet balance in Supabase database
    if (oldTx) {
      const targetWallet = wallets.find(w => w.id === oldTx.wallet_id);
      if (targetWallet) {
        await supabase
          .from('wallets')
          .update({ balance: targetWallet.balance })
          .eq('id', oldTx.wallet_id);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_txs_${userId}`, JSON.stringify(transactions));
      localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(wallets));
    }

    return { error };
  },

  fetchWallets: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      set({ wallets: data as Wallet[] });
      if (typeof window !== 'undefined') {
        localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(data));
      }
    } else {
      // Local cache fallback
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`finy_wallets_${userId}`);
        if (cached) {
          try {
            set({ wallets: JSON.parse(cached) });
            return;
          } catch (e) {}
        }
      }
      // Create defaults
      const defaults = DEFAULT_WALLETS(userId);
      set({ wallets: defaults });
      if (typeof window !== 'undefined') {
        localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(defaults));
      }
    }
  },

  addWallet: async (w) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in', data: null };

    const newWallet: Wallet = {
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: new Date().toISOString(),
      ...w
    };

    const wallets = [...get().wallets, newWallet];
    set({ wallets });

    const { data, error } = await supabase
      .from('wallets')
      .insert([newWallet])
      .select()
      .single();

    let saved = newWallet;
    if (!error && data) {
      saved = data as Wallet;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(wallets));
    }

    return { error, data: saved };
  },

  updateWallet: async (id, w) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const wallets = get().wallets.map(item => item.id === id ? { ...item, ...w } : item);
    set({ wallets });

    const { error } = await supabase
      .from('wallets')
      .update(w)
      .eq('id', id);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(wallets));
    }

    return { error };
  },

  deleteWallet: async (id) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in' };

    const wallets = get().wallets.filter(item => item.id !== id);
    set({ wallets });

    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', id);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(wallets));
    }

    return { error };
  },

  fetchCategories: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq('is_archived', false);

    if (!error && data) {
      set({ categories: data as Category[] });
    } else {
      set({ categories: DEFAULT_CATEGORIES });
    }
  },

  addCategory: async (cat) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { error: 'Not logged in', data: null };

    const newCat: Category = {
      ...cat,
      id: crypto.randomUUID(),
      user_id: userId
    };

    const categories = [...get().categories, newCat];
    set({ categories });

    const { data, error } = await supabase
      .from('categories')
      .insert([newCat])
      .select()
      .single();

    let saved = newCat;
    if (!error && data) {
      saved = data as Category;
    }

    return { error, data: saved };
  },

  updateCategory: async (id, cat) => {
    const categories = get().categories.map(item => item.id === id ? { ...item, ...cat } : item);
    set({ categories });

    const { error } = await supabase
      .from('categories')
      .update(cat)
      .eq('id', id);

    return { error };
  },

  deleteCategory: async (id) => {
    const categories = get().categories.filter(item => item.id !== id);
    set({ categories });

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    return { error };
  }
}));
