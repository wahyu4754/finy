import { useEffect, useMemo } from 'react';
import { useBudgetStore } from '../store/budget';
import { useTransactionStore } from '../store/transactions';
import { Budget, Transaction } from '../types';

export function useBudget(month: string) {
  const { budgets, fetchBudgets, upsertBudget, deleteBudget, loading } = useBudgetStore();
  const { transactions, fetchTransactions } = useTransactionStore();

  useEffect(() => {
    fetchBudgets(month);
    fetchTransactions(month);
  }, [month, fetchBudgets, fetchTransactions]);

  // Total monthly budget: category_id = null, wallet_id = null
  const totalBudget = useMemo(() => {
    return budgets.find(b => b.category_id === null && b.wallet_id === null)?.amount || 0;
  }, [budgets]);

  // Total spent in this month
  const totalSpent = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Spent categorized by wallet
  const spentByWallet = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        map[t.wallet_id] = (map[t.wallet_id] || 0) + t.amount;
      });
    return map;
  }, [transactions]);

  // Spent categorized by category
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        map[t.category_id] = (map[t.category_id] || 0) + t.amount;
      });
    return map;
  }, [transactions]);

  // Wallet budgets mapping
  const walletBudgets = useMemo(() => {
    return budgets.filter(b => b.wallet_id !== null && b.category_id === null);
  }, [budgets]);

  // Category budgets mapping
  const categoryBudgets = useMemo(() => {
    return budgets.filter(b => b.category_id !== null && b.wallet_id === null);
  }, [budgets]);

  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'var(--color-success)';
    if (percent < 80) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return {
    budgets,
    totalBudget,
    totalSpent,
    spentByWallet,
    spentByCategory,
    walletBudgets,
    categoryBudgets,
    loading,
    upsertBudget,
    deleteBudget,
    getProgressColor,
  };
}
