'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Repeat, Undo2, X } from 'lucide-react';
import { useRecurringStore } from '../store/recurring';
import { useToastStore } from '../store/toast';
import { formatCompact, formatDateRelative } from '../lib/format';
import styles from './RecurringActivityBanner.module.css';

const VISIBLE_ITEMS = 2;

/**
 * Tells the user what the daily cron recorded on their behalf and offers a way out.
 *
 * Auto-posting is the whole point of the feature — a bill that only gets recorded
 * when the app happens to be open is not recurring — but a silent write to someone's
 * ledger is exactly the kind of thing that destroys trust in a finance app. So every
 * auto-posted row is surfaced for a few days with a one-tap undo.
 */
export default function RecurringActivityBanner() {
  const { autoPosted, fetchAutoPosted, undoAutoPosted, dismissAutoPosted } = useRecurringStore();
  const { showToast } = useToastStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchAutoPosted();
  }, [fetchAutoPosted]);

  if (autoPosted.length === 0) return null;

  const handleUndo = async (id: string) => {
    setBusyId(id);
    const { error } = await undoAutoPosted(id);
    setBusyId(null);
    showToast(
      error ? 'Gagal membatalkan transaksi' : 'Transaksi rutin dibatalkan',
      error ? 'error' : 'success'
    );
  };

  const visible = autoPosted.slice(0, VISIBLE_ITEMS);
  const hiddenCount = autoPosted.length - visible.length;

  return (
    <div className={styles.banner}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Repeat size={14} />
          <span>
            {autoPosted.length} transaksi rutin baru dicatat otomatis
          </span>
        </div>
        <Link href="/recurring" className={styles.headerLink}>
          Kelola
        </Link>
      </div>

      <div className={styles.list}>
        {visible.map((tx) => (
          <div key={tx.id} className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowTitle}>{tx.category?.name || tx.note || 'Transaksi rutin'}</span>
              <span className={styles.rowMeta}>
                {formatDateRelative(tx.transaction_date)}
                {tx.wallet?.name ? ` · ${tx.wallet.name}` : ''}
              </span>
            </div>

            <span className={`${styles.rowAmount} ${tx.type === 'expense' ? styles.expense : styles.income}`}>
              {tx.type === 'expense' ? '-' : '+'}{formatCompact(tx.amount)}
            </span>

            <button
              type="button"
              onClick={() => handleUndo(tx.id)}
              disabled={busyId === tx.id}
              className={styles.undoBtn}
              aria-label="Batalkan transaksi"
            >
              <Undo2 size={13} />
            </button>

            <button
              type="button"
              onClick={() => dismissAutoPosted(tx.id)}
              className={styles.dismissBtn}
              aria-label="Tutup"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <p className={styles.more}>+{hiddenCount} lainnya di halaman Transaksi Berulang</p>
      )}
    </div>
  );
}
