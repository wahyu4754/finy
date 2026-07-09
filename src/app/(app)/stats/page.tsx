'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, PieChart as ChartIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTranslation } from '../../../lib/i18n';
import { useTransactionStore } from '../../../store/transactions';
import { formatIDR, formatCompact, getCurrentMonth } from '../../../lib/format';
import MonthPicker from '../../../components/ui/MonthPicker';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './Stats.module.css';

export default function StatsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { transactions, fetchTransactions, fetchCategories, fetchWallets, loading } = useTransactionStore();
  
  const [month, setMonth] = useState(getCurrentMonth());
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchWallets();
    fetchCategories();
    fetchTransactions(month);
  }, [fetchWallets, fetchCategories, fetchTransactions, month]);

  // Aggregate amounts by category
  const aggregatedData = React.useMemo(() => {
    const filtered = transactions.filter((tx) => tx.type === activeType);
    const categoryTotals: Record<string, { name: string; amount: number; color: string }> = {};

    filtered.forEach((tx) => {
      const catId = tx.category_id;
      const catName = tx.category?.name || 'Lainnya';
      const catColor = tx.category?.color || '#6B7280';

      if (!categoryTotals[catId]) {
        categoryTotals[catId] = { name: catName, amount: 0, color: catColor };
      }
      categoryTotals[catId].amount += tx.amount;
    });

    const total = Object.values(categoryTotals).reduce((sum, item) => sum + item.amount, 0);

    return Object.entries(categoryTotals).map(([id, item]) => ({
      id,
      name: item.name,
      value: item.amount,
      color: item.color,
      percentage: total > 0 ? Math.round((item.amount / total) * 100) : 0,
    })).sort((a, b) => b.value - a.value);
  }, [transactions, activeType]);

  const totalAmount = aggregatedData.reduce((sum, d) => sum + d.value, 0);

  if (!mounted) return null;

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('statsTitle')}</h2>
        <div style={{ width: 24 }} />
      </header>

      {/* Month Selector */}
      <div className={styles.pickerRow}>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* Expense/Income Switcher */}
      <SegmentedControl
        options={[
          { label: t('expense'), value: 'expense' },
          { label: t('income'), value: 'income' },
        ]}
        selectedValue={activeType}
        onChange={(val) => setActiveType(val as 'expense' | 'income')}
        className={styles.segment}
      />

      {/* Stats Summary Value Card */}
      <Card className={styles.summaryCard}>
        <span className={styles.summaryLabel}>
          Total {activeType === 'expense' ? t('expense') : t('income')}
        </span>
        <h3 className={`${styles.summaryVal} ${activeType === 'expense' ? styles.expense : styles.income}`}>
          {formatIDR(totalAmount)}
        </h3>
      </Card>

      {/* Pie Chart Display */}
      {loading ? (
        <div className={styles.loading}>{t('loading')}</div>
      ) : aggregatedData.length === 0 ? (
        <EmptyState
          title={t('statsEmpty')}
          description="Catat transaksi Anda untuk melihat analisis statistiknya di sini."
          icon={<ChartIcon size={24} />}
          actionText={t('add')}
          onActionClick={() => router.push('/transaction/new')}
        />
      ) : (
        <div className={styles.chartSection}>
          {/* Recharts PieChart (donut style) */}
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={aggregatedData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {aggregatedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatIDR(Number(value) || 0)}
                  contentStyle={{ 
                    borderRadius: '12px',
                    borderColor: 'var(--color-border)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Centered balance details inside Donut */}
            <div className={styles.centerLabel}>
              <span className={styles.centerSub}>Total</span>
              <span className={styles.centerVal}>{formatCompact(totalAmount)}</span>
            </div>
          </div>

          {/* Legend Items List */}
          <div className={styles.legendList}>
            {aggregatedData.map((item) => (
              <div key={item.id} className={styles.legendRow}>
                <div className={styles.legendLeft}>
                  <div 
                    className={styles.legendDot} 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className={styles.legendName}>{item.name}</span>
                </div>
                <div className={styles.legendRight}>
                  <span className={styles.legendPercentage}>{item.percentage}%</span>
                  <span className={styles.legendAmount}>{formatCompact(item.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
