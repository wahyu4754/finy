'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Plus, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useRecurringStore } from '../../../store/recurring';
import { formatIDR } from '../../../lib/format';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './Recurring.module.css';

export default function RecurringPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { rules, fetchRules, toggleRule, loading } = useRecurringStore();

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    await toggleRule(id, !currentStatus);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Transaksi Berulang</h2>
        <div style={{ width: 20 }} />
      </header>

      {/* Rules list */}
      <div className={styles.list}>
        {loading ? (
          <div className={styles.loading}>{t('loading')}</div>
        ) : rules.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi berulang"
            description="Atur pengeluaran rutin Anda seperti tagihan bulanan agar dicatat otomatis oleh sistem."
            icon={<Clock size={24} />}
          />
        ) : (
          rules.map((rule) => {
            const isExpense = rule.type === 'expense';
            return (
              <Card key={rule.id} className={styles.item} variant="outline">
                <div className={styles.itemHeader}>
                  <div className={styles.itemLeft}>
                    <Clock size={16} className={styles.clockIcon} />
                    <div>
                      <span className={styles.itemName}>
                        {rule.note || `Rutin ${rule.frequency}`}
                      </span>
                      <span className={styles.itemDesc}>
                        Next: {rule.next_due_date} ({rule.frequency})
                      </span>
                    </div>
                  </div>
                  
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${isExpense ? styles.expense : styles.income}`}>
                      {isExpense ? '-' : '+'}{formatIDR(rule.amount)}
                    </span>
                    <input
                      type="checkbox"
                      checked={rule.is_active}
                      onChange={() => handleToggle(rule.id, rule.is_active)}
                      className={styles.checkbox}
                    />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
