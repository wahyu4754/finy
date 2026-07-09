'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit2, Calendar, Wallet, FileText, Trash2, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import { useTransactionStore } from '../../../../store/transactions';
import { useToastStore } from '../../../../store/toast';
import { formatIDR, formatDate } from '../../../../lib/format';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import CategoryIcon from '../../../../components/ui/CategoryIcon';
import styles from './TransactionDetail.module.css';

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { transactions, deleteTransaction, fetchTransactions } = useTransactionStore();

  const tx = transactions.find((t) => t.id === id);

  useEffect(() => {
    if (!tx) {
      fetchTransactions();
    }
  }, [tx, fetchTransactions]);

  if (!tx) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      const { error } = await deleteTransaction(tx.id);
      if (error) {
        showToast('Gagal menghapus transaksi', 'error');
      } else {
        showToast('Transaksi berhasil dihapus', 'success');
        router.replace('/home');
      }
    }
  };

  const isExpense = tx.type === 'expense';
  const catColor = tx.category?.color || '#6B7280';

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Detail Transaksi</h2>
        <button 
          onClick={() => router.push(`/transaction/new?editId=${tx.id}`)} 
          className={styles.editBtn}
          aria-label="edit transaction"
        >
          <Edit2 size={18} />
        </button>
      </header>

      {/* Main Amount Card Details */}
      <Card className={styles.detailCard}>
        <div 
          className={styles.iconCircle}
          style={{ 
            backgroundColor: `${catColor}15`,
            color: catColor 
          }}
        >
          <CategoryIcon name={tx.category?.icon || 'Package'} size={32} />
        </div>
        
        <span className={styles.categoryName}>
          {tx.category?.name || 'Lainnya'}
        </span>

        <h3 className={`${styles.amount} ${isExpense ? styles.expense : styles.income}`}>
          {isExpense ? '-' : '+'}{formatIDR(tx.amount)}
        </h3>

        <div className={styles.badgeRow}>
          <Badge variant={isExpense ? 'danger' : 'success'}>
            {isExpense ? t('expense') : t('income')}
          </Badge>
          {tx.created_by_ai && (
            <Badge variant="default" className={styles.aiBadge}>
              <Sparkles size={10} style={{ marginRight: 4 }} />
              Dibuat oleh AI
            </Badge>
          )}
        </div>
      </Card>

      {/* Metadata Fields Rows */}
      <div className={styles.metaRows}>
        {/* Date Row */}
        <Card variant="outline" className={styles.metaRow}>
          <div className={styles.metaLeft}>
            <Calendar size={18} className={styles.metaIcon} />
            <span className={styles.metaLabel}>{t('date')}</span>
          </div>
          <span className={styles.metaValue}>{formatDate(tx.transaction_date)}</span>
        </Card>

        {/* Wallet Row */}
        <Card variant="outline" className={styles.metaRow}>
          <div className={styles.metaLeft}>
            <Wallet size={18} className={styles.metaIcon} />
            <span className={styles.metaLabel}>{t('wallet')}</span>
          </div>
          <span className={styles.metaValue}>{tx.wallet?.name || 'Dompet'}</span>
        </Card>

        {/* Note Row */}
        {tx.note && (
          <Card variant="outline" className={styles.metaRow}>
            <div className={styles.metaLeft}>
              <FileText size={18} className={styles.metaIcon} />
              <span className={styles.metaLabel}>{t('note')}</span>
            </div>
            <span className={styles.metaValueText}>{tx.note}</span>
          </Card>
        )}
      </div>

      {/* Delete button option */}
      <Button 
        onClick={handleDelete} 
        variant="outline" 
        icon={<Trash2 size={16} />}
        className={styles.deleteBtn}
        fullWidth
      >
        {t('delete')}
      </Button>
    </div>
  );
}
