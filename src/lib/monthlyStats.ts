import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { supabase } from './supabase';
import { useAuthStore } from '../store/auth';
import { MonthlyStats } from '../types';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: unknown): month is string {
  return typeof month === 'string' && MONTH_PATTERN.test(month);
}

/** Previous month in YYYY-MM, using date-fns so the year rollover is handled. */
export function getPreviousMonth(month: string): string {
  return format(addMonths(parseISO(`${month}-01`), -1), 'yyyy-MM');
}

/** The running month in YYYY-MM, on this device's clock. */
export function getRunningMonth(now: Date = new Date()): string {
  return format(now, 'yyyy-MM');
}

/**
 * True once `month` has fully passed.
 *
 * The analysis is a closed-book summary of a finished month, so the running month
 * is never eligible — its answer would change every time the user records another
 * transaction. The edge function enforces the same rule in Asia/Jakarta and is
 * authoritative; this local copy exists so the UI can hide a button the server
 * would refuse, and the two only disagree in the hours around a month boundary
 * for a device set outside WIB.
 */
export function isMonthClosed(month: string, now: Date = new Date()): boolean {
  return isValidMonth(month) && month < getRunningMonth(now);
}

/** The last `count` closed months, newest first — what /insights lists. */
export function getClosedMonths(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    format(addMonths(startOfMonth(now), -(i + 1)), 'yyyy-MM')
  );
}

/**
 * First day after `month`, as YYYY-MM-DD — the date the analysis unlocks.
 * Returned as a string rather than a Date so callers can hand it straight to
 * formatDate() without an ISO round-trip that would shift it a day for devices
 * west of UTC.
 */
export function getMonthCloseDate(month: string): string {
  return format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM-dd');
}

const sum = (rows: Array<{ amount: number }> | null | undefined): number =>
  (rows ?? []).reduce((total, row) => total + (Number(row?.amount) || 0), 0);

/**
 * Collects the real figures for one month that `monthly-conclusion` analyses.
 *
 * Reads straight from Supabase rather than from the stores on purpose: the
 * transaction store only ever holds a single month, so the previous-month
 * comparison would have to overwrite it mid-flight. Every query must succeed —
 * a partial read would hand the model invented zeros, which is the exact
 * failure this replaced (audit C-11).
 */
export async function buildMonthlyStats(month: string): Promise<MonthlyStats> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('UNAUTHORIZED');
  if (!isValidMonth(month)) throw new Error('INVALID_MONTH');

  const start = `${month}-01`;
  const end = format(addMonths(parseISO(start), 1), 'yyyy-MM-dd');
  const prevStart = `${getPreviousMonth(month)}-01`;

  const [txRes, prevRes, budgetRes, walletRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, note, transaction_date, category:categories(name)')
      .eq('user_id', userId)
      .gte('transaction_date', start)
      .lt('transaction_date', end),
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', prevStart)
      .lt('transaction_date', start),
    supabase
      .from('budgets')
      .select('amount, category_id, wallet_id')
      .eq('user_id', userId)
      .eq('month', month),
    supabase.from('wallets').select('balance').eq('user_id', userId),
  ]);

  const failed = [txRes, prevRes, budgetRes, walletRes].find((res) => res.error);
  if (failed) throw new Error(failed.error.message || 'Gagal memuat data keuangan');

  const transactions = (txRes.data ?? []) as Array<{
    amount: number;
    type: string;
    note: string | null;
    transaction_date: string;
    category?: { name?: string } | null;
  }>;

  const expenses = transactions.filter((tx) => tx.type === 'expense');
  const totalExpense = Math.round(sum(expenses));
  const totalIncome = Math.round(sum(transactions.filter((tx) => tx.type === 'income')));

  const byCategory = new Map<string, number>();
  expenses.forEach((tx) => {
    const name = tx.category?.name || 'Lainnya';
    byCategory.set(name, (byCategory.get(name) ?? 0) + (Number(tx.amount) || 0));
  });

  const categoryBreakdown = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topTransactions = [...expenses]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5)
    .map((tx) => ({
      note: tx.note || tx.category?.name || 'Transaksi',
      category: tx.category?.name || 'Lainnya',
      amount: Math.round(Number(tx.amount) || 0),
      date: tx.transaction_date,
    }));

  const budgets = (budgetRes.data ?? []) as Array<{
    amount: number;
    category_id: string | null;
    wallet_id: string | null;
  }>;
  const totalBudget = budgets.find((b) => b.category_id === null && b.wallet_id === null)?.amount ?? 0;
  // Users who budget per category instead of globally would otherwise show Rp 0,
  // which reads to the model as "no budget set" rather than "budget is split up".
  const categoryBudgetTotal = budgets
    .filter((b) => b.category_id !== null && b.wallet_id === null)
    .reduce((total, b) => total + (Number(b.amount) || 0), 0);

  const totalBalance = (walletRes.data ?? []).reduce(
    (total: number, wallet: { balance: number }) => total + (Number(wallet?.balance) || 0),
    0
  );

  return {
    totalBalance: Math.round(totalBalance),
    totalExpense,
    totalIncome,
    budget: Math.round(totalBudget || categoryBudgetTotal),
    lastMonthExpense: Math.round(sum(prevRes.data as Array<{ amount: number }> | null)),
    transactionCount: transactions.length,
    categoryBreakdown,
    topTransactions,
  };
}
