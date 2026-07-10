'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  AddCircle as Plus, Camera, Stars as Sparkles, GraphUp as TrendingUp, GraphDown as TrendingDown, 
  AltArrowRight as ChevronRight, GraphNew as BarChart3, DangerCircle as AlertCircle 
} from '@solar-icons/react';
import { useTranslation } from '../../../lib/i18n';
import { useAuthStore } from '../../../store/auth';
import { useTransactionStore } from '../../../store/transactions';
import { useBudget } from '../../../hooks/useBudget';
import { formatIDR, getCurrentMonth, getToday, formatCompact, calculateStreak } from '../../../lib/format';
import { useToastStore } from '../../../store/toast';
import Card from '../../../components/ui/Card';
import StreakBadge from '../../../components/ui/StreakBadge';
import ProgressBar from '../../../components/ui/ProgressBar';
import CategoryIcon from '../../../components/ui/CategoryIcon';
import StreakShareModal from '../../../components/StreakShareModal';
import FinyTree from '../../../components/ui/FinyTree';
import styles from './Home.module.css';

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  
  const currentMonth = getCurrentMonth();
  
  const { 
    transactions, 
    wallets, 
    fetchTransactions, 
    fetchWallets, 
    fetchCategories,
    loading: txLoading,
    setAddTxOpen
  } = useTransactionStore();

  const { 
    totalBudget, 
    totalSpent, 
    getProgressColor 
  } = useBudget(currentMonth);

  // Swipeable wallet carousel state
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);

  // Touch handlers for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    fetchWallets();
    fetchCategories();
    fetchTransactions(currentMonth);
  }, [fetchWallets, fetchCategories, fetchTransactions, currentMonth]);

  // Handle Swipe logic
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    const totalCards = wallets.length + 1; // "All" + each wallet

    if (isLeftSwipe) {
      setSelectedWalletIndex((prev) => (prev < totalCards - 1 ? prev + 1 : prev));
    } else if (isRightSwipe) {
      setSelectedWalletIndex((prev) => (prev > 0 ? prev - 1 : prev));
    }
  };

  // Calculations based on selected card
  const selectedWallet = selectedWalletIndex > 0 ? wallets[selectedWalletIndex - 1] : null;

  // Filter transactions dynamically based on the active wallet
  const activeTransactions = selectedWallet
    ? transactions.filter(t => t.wallet_id === selectedWallet.id)
    : transactions;

  // Income & Expense calculated from active transactions
  const activeIncome = activeTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const activeExpense = activeTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Balance based on selection
  const activeBalance = selectedWallet
    ? selectedWallet.balance
    : wallets.reduce((sum, w) => sum + w.balance, 0);

  const activeWalletName = selectedWallet
    ? selectedWallet.name
    : 'Semua Dompet';

  const recentTxs = activeTransactions.slice(0, 5);

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
        <StreakBadge 
          streak={calculateStreak(transactions)} 
          onClick={() => setIsStreakModalOpen(true)}
        />
      </header>

      <FinyTree 
        streak={calculateStreak(transactions)}
        hasAddedToday={transactions.some(tx => tx.transaction_date === new Date().toISOString().slice(0, 10))}
        onWaterClick={() => setAddTxOpen(true)}
      />

      {/* Balance Card Wrapper with Swipe handlers */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={styles.carouselContainer}
      >
        <div 
          className={styles.carouselTrack}
          style={{ transform: `translateX(-${selectedWalletIndex * 100}%)` }}
        >
          {/* Card 0: Semua Dompet */}
          <div className={styles.carouselSlide}>
            <Card variant="default" className={styles.balanceCard}>
              <div className={styles.balanceHeaderRow}>
                <span className={styles.balanceLabel}>Semua Dompet</span>
              </div>
              <h3 className={styles.balanceAmount}>
                {formatIDR(wallets.reduce((sum, w) => sum + w.balance, 0))}
              </h3>

              <div className={styles.summaryRow}>
                <div className={styles.summaryItem}>
                  <div className={`${styles.iconBg} ${styles.incomeBg}`}>
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <span className={styles.summaryLabel}>{t('income')}</span>
                    <p className={`${styles.summaryVal} ${styles.incomeText}`}>
                      {formatIDR(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
                    </p>
                  </div>
                </div>

                <div className={styles.summaryItem}>
                  <div className={`${styles.iconBg} ${styles.expenseBg}`}>
                    <TrendingDown size={16} />
                  </div>
                  <div>
                    <span className={styles.summaryLabel}>{t('expense')}</span>
                    <p className={`${styles.summaryVal} ${styles.expenseText}`}>
                      {formatIDR(transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Cards for each specific wallet */}
          {wallets.map((w) => {
            const walletTxs = transactions.filter(tx => tx.wallet_id === w.id);
            const income = walletTxs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
            const expense = walletTxs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);

            return (
              <div key={w.id} className={styles.carouselSlide}>
                <Card variant="default" className={styles.balanceCard}>
                  <div className={styles.balanceHeaderRow}>
                    <span className={styles.balanceLabel}>{w.name}</span>
                    <span className={styles.walletTypeTag}>
                      {t(`walletType${w.type.charAt(0).toUpperCase() + w.type.slice(1)}` as any)}
                    </span>
                  </div>
                  <h3 className={styles.balanceAmount}>{formatIDR(w.balance)}</h3>

                  <div className={styles.summaryRow}>
                    <div className={styles.summaryItem}>
                      <div className={`${styles.iconBg} ${styles.incomeBg}`}>
                        <TrendingUp size={16} />
                      </div>
                      <div>
                        <span className={styles.summaryLabel}>{t('income')}</span>
                        <p className={`${styles.summaryVal} ${styles.incomeText}`}>{formatIDR(income)}</p>
                      </div>
                    </div>

                    <div className={styles.summaryItem}>
                      <div className={`${styles.iconBg} ${styles.expenseBg}`}>
                        <TrendingDown size={16} />
                      </div>
                      <div>
                        <span className={styles.summaryLabel}>{t('expense')}</span>
                        <p className={`${styles.summaryVal} ${styles.expenseText}`}>{formatIDR(expense)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dot Indicators */}
      <div className={styles.carouselDots}>
        {Array.from({ length: wallets.length + 1 }).map((_, i) => (
          <button
            key={i}
            onClick={() => setSelectedWalletIndex(i)}
            className={`${styles.dot} ${selectedWalletIndex === i ? styles.activeDot : ''}`}
            aria-label={`Go to card ${i}`}
            type="button"
          />
        ))}
      </div>

      {/* Quick Action Grid */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('quickActions')}</h4>
        <div className={styles.actionGrid}>
          <button onClick={() => setAddTxOpen(true)} className={styles.actionBtn} type="button">
            <div className={`${styles.actionIcon} ${styles.actionPlus}`}>
              <Plus size={20} />
            </div>
            <span className={styles.actionLabel}>{t('add')}</span>
          </button>

          <button onClick={handleScanClick} className={styles.actionBtn} type="button">
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

      {/* Recent Transactions List */}
      <section className={styles.section} style={{ marginBottom: '80px' }}>
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

      <StreakShareModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streak={calculateStreak(transactions)}
      />
    </div>
  );
}
