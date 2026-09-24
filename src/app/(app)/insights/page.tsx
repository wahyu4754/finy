'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Lock, ChevronRight, CheckCircle2, Inbox } from 'lucide-react';
import { useMonthlyInsights, MonthStatus } from '../../../hooks/useMonthlyInsights';
import { formatMonthDisplay, formatDate } from '../../../lib/format';
import { getRunningMonth, getMonthCloseDate } from '../../../lib/monthlyStats';
import Card from '../../../components/ui/Card';
import styles from './Insights.module.css';

const STATUS_COPY: Record<MonthStatus, { label: string; className: string }> = {
  saved: { label: 'Tersimpan', className: styles.statusSaved },
  ready: { label: 'Siap dibuat', className: styles.statusReady },
  empty: { label: 'Tidak ada data', className: styles.statusEmpty },
};

export default function InsightsPage() {
  const router = useRouter();
  const { statusOf, months, loading } = useMonthlyInsights(6);
  const runningMonth = getRunningMonth();

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Analisis Bulanan</h2>
        <div style={{ width: 24 }} />
      </header>

      <p className={styles.intro}>
        Ringkasan AI untuk setiap bulan yang sudah berakhir. Gratis untuk semua pengguna,
        satu kali per bulan.
      </p>

      {/* The month in progress can't be summarised yet — it isn't finished. */}
      <Card className={styles.row} variant="outline">
        <div className={styles.rowLeft}>
          <div className={styles.lockedCircle}>
            <Lock size={16} />
          </div>
          <div>
            <span className={styles.monthName}>{formatMonthDisplay(runningMonth)}</span>
            <p className={styles.previewText}>
              Tersedia {formatDate(getMonthCloseDate(runningMonth))}
            </p>
          </div>
        </div>
        <span className={`${styles.statusBadge} ${styles.statusLocked}`}>Berjalan</span>
      </Card>

      {/* Closed months */}
      <div className={styles.list}>
        {months.map((month) => {
          const status = loading ? undefined : statusOf(month);
          const copy = status ? STATUS_COPY[status] : null;
          const canOpen = status === 'saved' || status === 'ready';

          const body = (
            <>
              <div className={styles.rowLeft}>
                <div className={canOpen ? styles.sparkleCircle : styles.lockedCircle}>
                  {status === 'saved' ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
                </div>
                <div>
                  <span className={styles.monthName}>{formatMonthDisplay(month)}</span>
                  <p className={styles.previewText}>
                    {!status
                      ? 'Memeriksa…'
                      : status === 'saved'
                        ? 'Lihat kesimpulan yang tersimpan'
                        : status === 'ready'
                          ? 'Buat kesimpulan AI untuk bulan ini'
                          : 'Belum ada transaksi tercatat'}
                  </p>
                </div>
              </div>

              {copy ? (
                <span className={`${styles.statusBadge} ${copy.className}`}>{copy.label}</span>
              ) : (
                <Inbox size={16} className={styles.chevron} />
              )}
              {canOpen && <ChevronRight size={16} className={styles.chevron} />}
            </>
          );

          return canOpen ? (
            <Link key={month} href={`/insights/${month}`}>
              <Card className={`${styles.row} ${styles.clickableRow}`} variant="outline">
                {body}
              </Card>
            </Link>
          ) : (
            <Card key={month} className={`${styles.row} ${styles.disabledRow}`} variant="outline">
              {body}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
