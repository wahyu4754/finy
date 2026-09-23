import { create } from 'zustand';
import { addMonths, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Transaction, Wallet, Category } from '../types';
import { useAuthStore } from './auth';

interface TransactionState {
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  loading: boolean;
  isAddTxOpen: boolean;
  setAddTxOpen: (open: boolean) => void;
  editTxId: string | null;
  setEditTxId: (id: string | null) => void;

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

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  wallets: [],
  categories: [],
  loading: false,
  isAddTxOpen: false,
  setAddTxOpen: (open) => set({ isAddTxOpen: open }),
  editTxId: null,
  setEditTxId: (id) => set({ editTxId: id }),

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
      // Hand-rolled arithmetic here previously dropped the year rollover, so December
      // produced .gte('YYYY-12-01').lt('YYYY-01-01') — an empty range that made the
      // whole app look like it had lost every transaction.
      const endDate = format(addMonths(parseISO(startDate), 1), 'yyyy-MM-dd');

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
    const prevWallets = get().wallets;
    const wallets = prevWallets.map(w => {
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

    // A rejected insert must neither move money nor appear in the list. Previously the
    // optimistic wallet delta was persisted and a fabricated row (with an id that never
    // reached Postgres) was prepended and cached regardless of `error`, so the UI showed
    // a transaction that did not exist while the real balance silently drifted.
    if (error || !data) {
      set({ wallets: prevWallets });
      return { error: error ?? 'Gagal mencatat transaksi', data: null };
    }

    const savedTx = data as Transaction;

    // Wallet balance is updated atomically by a DB trigger (migration 017).

    // Update transactions list
    const transactions = [savedTx, ...get().transactions];
    set({ transactions });

    // Cache transactions locally
    if (typeof window !== 'undefined') {
      localStorage.setItem(`finy_txs_${userId}`, JSON.stringify(transactions));
      localStorage.setItem(`finy_wallets_${userId}`, JSON.stringify(wallets));
    }

    return { error: null, data: savedTx };
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

    // Wallet balance is updated atomically by a DB trigger (migration 017).

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

    // Wallet balance is updated atomically by a DB trigger (migration 017).

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
      // Keep existing state; try localStorage cache as last resort
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`finy_wallets_${userId}`);
        if (cached) {
          try {
            set({ wallets: JSON.parse(cached) });
            return;
          } catch (e) {}
        }
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
