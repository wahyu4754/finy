'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Lock, ChevronRight, Calendar } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { formatMonthDisplay } from '../../../lib/format';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import styles from './Insights.module.css';

const MONTHS_LIST = ['2026-07', '2026-06', '2026-05'];

export default function InsightsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isVip } = useFeatureAccess();

  // If not VIP, display Lock screen
  if (!isVip) {
    return (
      <div className={styles.containerLocked}>
        <div className={styles.lockHero}>
          <div className={styles.lockCircle}>
            <Lock size={32} />
          </div>
          <h3 className={styles.lockTitle}>Kesimpulan Keuangan AI</h3>
          <p className={styles.lockSubtitle}>
            Dapatkan kesimpulan analisis keuangan bulanan otomatis yang dihasilkan secara pintar oleh kecerdasan buatan AI.
          </p>
          <Button onClick={() => router.push('/upgrade')} className={styles.upgradeBtn}>
            Upgrade ke Finy Pro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Analisis Kesimpulan AI</h2>
        <div style={{ width: 24 }} />
      </header>

      {/* List of months */}
      <div className={styles.list}>
        {MONTHS_LIST.map((m) => (
          <Link key={m} href={`/insights/${m}`}>
            <Card className={styles.row} variant="outline">
              <div className={styles.rowLeft}>
                <div className={styles.sparkleCircle}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <span className={styles.monthName}>{formatMonthDisplay(m)}</span>
                  <p className={styles.previewText}>Klik untuk melihat ringkasan analisis AI...</p>
                </div>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
