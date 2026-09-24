import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { getClosedMonths } from '../lib/monthlyStats';

/**
 * 'saved'  — an analysis is stored, opening the month shows it for free
 * 'ready'  — the month is closed and has transactions, so it can be generated
 * 'empty'  — nothing was recorded that month, there is nothing to analyse
 */
export type MonthStatus = 'saved' | 'ready' | 'empty';

interface MonthlyInsights {
  statusOf: (month: string) => MonthStatus | undefined;
  /** Newest closed month that still has an analysis available to generate. */
  pendingMonth: string | null;
  months: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const monthStart = (month: string) => `${month}-01`;
const nextMonthStart = (month: string) =>
  format(addMonths(parseISO(monthStart(month)), 1), 'yyyy-MM-dd');

/**
 * Reads the per-month state the insights list and the Home prompt both need.
 *
 * Counts come from `head: true` queries rather than pulling the transactions
 * themselves: six months of history would otherwise be downloaded on every Home
 * render just to decide whether a badge says "ready" or "empty".
 */
export function useMonthlyInsights(count = 6): MonthlyInsights {
  const userId = useAuthStore((state) => state.user?.id);
  const months = useMemo(() => getClosedMonths(count), [count]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [hasData, setHasData] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId || months.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [conclusionsRes, ...countRes] = await Promise.all([
        supabase.from('ai_conclusions').select('month').eq('user_id', userId),
        ...months.map((month) =>
          supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('transaction_date', monthStart(month))
            .lt('transaction_date', nextMonthStart(month))
        ),
      ]);

      if (!conclusionsRes.error) {
        setSaved(new Set((conclusionsRes.data ?? []).map((row: { month: string }) => row.month)));
      }

      setHasData(
        new Set(months.filter((_, i) => (countRes[i]?.count ?? 0) > 0))
      );
    } finally {
      setLoading(false);
    }
  }, [userId, months]);

  useEffect(() => {
    load();
  }, [load]);

  const statusOf = useCallback(
    (month: string): MonthStatus | undefined => {
      if (saved.has(month)) return 'saved';
      if (hasData.has(month)) return 'ready';
      // Before the counts land every month would read as 'empty', which flashes a
      // wrong badge on the list page.
      return hasData.size > 0 || !loading ? 'empty' : undefined;
    },
    [saved, hasData, loading]
  );

  const pendingMonth = months.find((month) => statusOf(month) === 'ready') ?? null;

  return { statusOf, pendingMonth, months, loading, refresh: load };
}
