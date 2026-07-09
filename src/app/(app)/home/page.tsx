'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Camera, Sparkles, TrendingUp, TrendingDown, Wallet, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useAuthStore } from '../../../store/auth';
import { useTransactionStore } from '../../../store/transactions';
import { useBudget } from '../../../hooks/useBudget';
import { formatIDR, getCurrentMonth, getToday, formatCompact } from '../../../lib/format';
import { useToastStore } from '../../../store/toast';
import Card from '../../../components/ui/Card';
import StreakBadge from '../../../components/ui/StreakBadge';
import ProgressBar from '../../../components/ui/ProgressBar';
import CategoryIcon from '../../../components/ui/CategoryIcon';
import styles from './Home.module.css';

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  
  const currentMonth = getCurrentMonth();
  
  const { 
    transactions, 
    wallets, 
    fetchTransactions, 
    fetchWallets, 
    fetchCategories,
    loading: txLoading 
  } = useTransactionStore();

  const { 
    totalBudget, 
    totalSpent, 
    getProgressColor 
  } = useBudget(currentMonth);

  useEffect(() => {
    fetchWallets();
    fetchCategories();
    fetchTransactions(currentMonth);
  }, [fetchWallets, fetchCategories, fetchTransactions, currentMonth]);

  // Calculations
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  const monthlyIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const recentTxs = transactions.slice(0, 5);

  const handleScanClick = () => {
    router.push('/ai-assistant?scan=true');
  };

  return (
    <div className={styles.container}>
      {/* Greetings Header */}
      <header className={styles.header}>
        <div>
          <h2 className={styles.greeting}>
            {t('hello')}, {user?.name || 'User'}! 👋
          </h2>
          <p className={styles.dateDisplay}>{getToday()}</p>
        </div>
        <StreakBadge streak={3} /> {/* Mock active streak of 3 */}
      </header>

      {/* Balance Card */}
      <Card variant="default" className={styles.balanceCard}>
        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>{t('totalBalance')}</span>
          <h3 className={styles.balanceAmount}>{formatIDR(totalBalance)}</h3>
        </div>

        <div className={styles.summaryRow}>
          <div className={styles.summaryItem}>
            <div className={`${styles.iconBg} ${styles.incomeBg}`}>
              <TrendingUp size={16} />
            </div>
            <div>
              <span className={styles.summaryLabel}>{t('income')}</span>
              <p className={`${styles.summaryVal} ${styles.incomeText}`}>{formatIDR(monthlyIncome)}</p>
            </div>
          </div>

          <div className={styles.summaryItem}>
            <div className={`${styles.iconBg} ${styles.expenseBg}`}>
              <TrendingDown size={16} />
            </div>
            <div>
              <span className={styles.summaryLabel}>{t('expense')}</span>
              <p className={`${styles.summaryVal} ${styles.expenseText}`}>{formatIDR(monthlyExpense)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Action Grid */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('quickActions')}</h4>
        <div className={styles.actionGrid}>
          <Link href="/transaction/new" className={styles.actionBtn}>
            <div className={`${styles.actionIcon} ${styles.actionPlus}`}>
              <Plus size={20} />
            </div>
            <span className={styles.actionLabel}>{t('add')}</span>
          </Link>

          <button onClick={handleScanClick} className={styles.actionBtn}>
            <div className={`${styles.actionIcon} ${styles.actionScan}`}>
              <Camera size={20} />
            </div>
            <span className={styles.actionLabel}>{t('scanReceipt')}</span>
          </button>

          <Link href="/ai-assistant" className={styles.actionBtn}>
            <div className={`${styles.actionIcon} ${styles.actionAi}`}>
              <Sparkles size={20} />
            </div>
            <span className={styles.actionLabel}>{t('aiAssistant')}</span>
          </Link>

          <Link href="/stats" className={styles.actionBtn}>
            <div className={`${styles.actionIcon} ${styles.actionStats}`}>
              <BarChart3 size={20} />
            </div>
            <span className={styles.actionLabel}>{t('tabStats')}</span>
          </Link>
        </div>
      </section>

      {/* Budget Progress Card */}
      {totalBudget > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t('budgetProgress')}</h4>
          <Card className={styles.budgetCard}>
            <div className={styles.budgetHeader}>
              <span className={styles.budgetName}>{t('budgetTotal')}</span>
              <span className={styles.budgetRatio}>
                <strong>{formatIDR(totalSpent)}</strong> / {formatIDR(totalBudget)}
              </span>
            </div>
            <ProgressBar value={totalSpent} max={totalBudget} />
            <div className={styles.budgetFooter}>
              {totalSpent > totalBudget ? (
                <span className={styles.alertText}>
                  <AlertCircle size={12} />
                  {t('budgetOverspent')} ({formatIDR(totalSpent - totalBudget)})
                </span>
              ) : (
                <span className={styles.remainingText}>
                  {t('budgetRemaining')}: {formatIDR(totalBudget - totalSpent)}
                </span>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* Wallets Preview */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>{t('wallet')}</h4>
          <Link href="/wallets" className={styles.sectionLink}>
            {t('viewAll')} <ChevronRight size={14} />
          </Link>
        </div>
        <div className={styles.walletScroll}>
          {wallets.map((w) => (
            <Card key={w.id} className={styles.walletCard}>
              <div className={styles.walletTop}>
                <Wallet size={18} className={styles.walletIcon} />
                <span className={styles.walletName}>{w.name}</span>
              </div>
              <h5 className={styles.walletBalance}>{formatIDR(w.balance)}</h5>
              <span className={styles.walletType}>{t(`walletType${w.type.charAt(0).toUpperCase() + w.type.slice(1)}` as any)}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent Transactions List */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>{t('recentTransactions')}</h4>
          <Link href="/transactions" className={styles.sectionLink}>
            {t('viewAll')} <ChevronRight size={14} />
          </Link>
        </div>

        <div className={styles.txList}>
          {recentTxs.length === 0 ? (
            <Card className={styles.emptyCard}>
              <p className={styles.emptyText}>Belum ada transaksi di bulan ini.</p>
            </Card>
          ) : (
            recentTxs.map((tx) => {
              const isExpense = tx.type === 'expense';
              return (
                <Link key={tx.id} href={`/transaction/${tx.id}`}>
                  <Card className={styles.txRow} variant="outline">
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
                        {isExpense ? '-' : '+'}{formatCompact(tx.amount)}
                      </span>
                      <span className={styles.txDate}>{tx.transaction_date}</span>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
