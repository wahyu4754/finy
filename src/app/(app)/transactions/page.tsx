'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Plus, Filter, Package } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useTransactionStore } from '../../../store/transactions';
import { formatIDR, formatCompact, getCurrentMonth, formatDate } from '../../../lib/format';
import MonthPicker from '../../../components/ui/MonthPicker';
import CategoryIcon from '../../../components/ui/CategoryIcon';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import styles from './Transactions.module.css';

export default function TransactionsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { transactions, fetchTransactions, fetchCategories, fetchWallets, loading } = useTransactionStore();
  const [month, setMonth] = useState(getCurrentMonth());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  useEffect(() => {
    fetchWallets();
    fetchCategories();
    fetchTransactions(month);
  }, [fetchWallets, fetchCategories, fetchTransactions, month]);

  // Group by date
  const filtered = transactions.filter((tx) => {
    const matchesSearch = tx.note.toLowerCase().includes(search.toLowerCase()) || 
                          tx.category?.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate stats for filtered month
  const monthlyIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Grouping logic
  const groupedTransactions: Record<string, typeof transactions> = {};
  filtered.forEach((tx) => {
    const dateKey = tx.transaction_date;
    if (!groupedTransactions[dateKey]) {
      groupedTransactions[dateKey] = [];
    }
    groupedTransactions[dateKey].push(tx);
  });

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Riwayat Transaksi</h2>
        <Link href="/transaction/new" className={styles.addBtn}>
          <Plus size={20} />
        </Link>
      </header>

      {/* Month Picker Selector */}
      <div className={styles.pickerRow}>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* Monthly Summary Statistics */}
      <Card className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income')}</span>
          <span className={`${styles.summaryVal} ${styles.income}`}>{formatIDR(monthlyIncome)}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('expense')}</span>
          <span className={`${styles.summaryVal} ${styles.expense}`}>{formatIDR(monthlyExpense)}</span>
        </div>
      </Card>

      {/* Filters & Search Row */}
      <div className={styles.filterRow}>
        <Input
          placeholder="Cari transaksi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
          className={styles.searchInput}
        />
        
        <div className={styles.filterChips}>
          {(['all', 'expense', 'income'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTypeFilter(filter)}
              className={`${styles.chip} ${typeFilter === filter ? styles.activeChip : ''}`}
            >
              {filter === 'all' ? t('all') : t(filter)}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Grouped List */}
      <div className={styles.listContainer}>
        {loading ? (
          <div className={styles.loading}>{t('loading')}</div>
        ) : sortedDates.length === 0 ? (
          <Card className={styles.emptyCard}>
            <p className={styles.emptyText}>Tidak ada transaksi ditemukan.</p>
          </Card>
        ) : (
          sortedDates.map((dateKey) => {
            const dateTxs = groupedTransactions[dateKey];
            
            // Calculate daily total
            const dailyNet = dateTxs.reduce((sum, t) => {
              return sum + (t.type === 'expense' ? -t.amount : t.amount);
            }, 0);

            return (
              <div key={dateKey} className={styles.dateGroup}>
                {/* Date header */}
                <div className={styles.dateHeader}>
                  <span className={styles.dateLabel}>{formatDate(dateKey)}</span>
                  <span className={`${styles.dateTotal} ${dailyNet >= 0 ? styles.positive : styles.negative}`}>
                    {dailyNet >= 0 ? '+' : ''}{formatCompact(dailyNet)}
                  </span>
                </div>

                {/* Date transactions rows */}
                <div className={styles.rows}>
                  {dateTxs.map((tx) => {
                    const isExpense = tx.type === 'expense';
                    return (
                      <Link key={tx.id} href={`/transaction/${tx.id}`}>
                        <div className={styles.txRow}>
                          <div 
                            className={styles.txIconCircle}
                            style={{ 
                              backgroundColor: `${tx.category?.color || '#6B7280'}15`,
                              color: tx.category?.color || '#6B7280' 
                            }}
                          >
                            <CategoryIcon name={tx.category?.icon || 'Package'} size={18} />
                          </div>

                          <div className={styles.txInfo}>
                            <span className={styles.txCategory}>{tx.category?.name || 'Lainnya'}</span>
                            <span className={styles.txWallet}>{tx.wallet?.name || 'Dompet'}</span>
                          </div>

                          <div className={styles.txRight}>
                            <span className={`${styles.txAmount} ${isExpense ? styles.txExpense : styles.txIncome}`}>
                              {isExpense ? '-' : '+'}{formatIDR(tx.amount)}
                            </span>
                            {tx.note && <span className={styles.txNote}>{tx.note}</span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
