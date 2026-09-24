'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertTriangle, Lightbulb, Award, Receipt, CalendarClock } from 'lucide-react';
import { useToastStore } from '../../../../store/toast';
import { generateMonthlyConclusion } from '../../../../lib/scanReceipt';
import { buildMonthlyStats, isMonthClosed, getMonthCloseDate } from '../../../../lib/monthlyStats';
import { formatMonthDisplay, formatDate } from '../../../../lib/format';
import { AIConclusion } from '../../../../types';
import Card from '../../../../components/ui/Card';
import EmptyState from '../../../../components/ui/EmptyState';
import styles from './InsightDetail.module.css';

const iconMap = {
  warning: AlertTriangle,
  tip: Lightbulb,
  praise: Award,
};

const colorMap = {
  warning: '#EF4444', // Red
  tip: '#3B82F6',     // Blue
  praise: '#10B981',  // Green
};

// The edge function throws machine-readable codes; map the ones worth explaining.
const ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED: 'Terlalu banyak permintaan. Coba lagi beberapa menit.',
  NO_DATA: 'Belum ada transaksi yang tercatat di bulan ini.',
  MONTH_NOT_CLOSED: 'Bulan ini belum berakhir, jadi belum bisa dianalisis.',
  AI_NOT_CONFIGURED: 'Layanan AI belum dikonfigurasi. Hubungi dukungan Finy.',
  AI_SERVICE_ERROR: 'Layanan AI sedang tidak dapat dihubungi. Coba lagi sebentar.',
  AI_EMPTY_RESPONSE: 'Layanan AI tidak mengembalikan jawaban. Coba lagi sebentar.',
  AI_INVALID_RESPONSE: 'Jawaban AI tidak dapat dibaca. Coba buat ulang analisis.',
  UNAUTHORIZED: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  INVALID_MONTH: 'Format bulan tidak valid.',
};

export default function InsightDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawMonth = params?.month;
  const month = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth;

  const { showToast } = useToastStore();
  const [data, setData] = useState<AIConclusion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const inFlightRef = useRef<string | null>(null);

  // Recomputed per render on purpose: a page left open across midnight on the last
  // day of a month should notice that the month has closed.
  const monthClosed = !!month && isMonthClosed(month);

  const load = useCallback(async () => {
    if (!month) return;

    // React runs effects twice in dev (StrictMode). Both runs would miss the cache
    // because neither has written it yet, so each would fire a Gemini call for one view.
    if (inFlightRef.current === month) return;
    inFlightRef.current = month;

    setLoading(true);
    setError(null);
    try {
      const stats = await buildMonthlyStats(month);

      // Never ask Gemini to analyse an empty month — that is how the feature used to
      // produce confident, entirely invented prose.
      if (stats.transactionCount === 0) {
        setData(null);
        setIsEmpty(true);
        return;
      }

      setIsEmpty(false);
      const conclusion = await generateMonthlyConclusion(month, stats);
      setData(conclusion);

      // Only a freshly generated answer is worth announcing; a cached one was
      // already shown to this user before.
      if (!conclusion.cached) showToast(`Analisis ${formatMonthDisplay(month)} berhasil dibuat`, 'success');
    } catch (err) {
      // Nothing was stored server-side, so the retry below is a genuine retry.
      const code = err instanceof Error ? err.message : '';
      const message = ERROR_MESSAGES[code] ?? 'Gagal memuat kesimpulan AI. Coba lagi nanti.';
      setData(null);
      setIsEmpty(false);
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
      inFlightRef.current = null;
    }
  }, [month, showToast]);

  useEffect(() => {
    if (!month || !monthClosed) {
      setLoading(false);
      return;
    }
    load();
  }, [load, month, monthClosed]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Analisis {month ? formatMonthDisplay(month) : ''}</h2>
        <div style={{ width: 24 }} />
      </header>

      {!monthClosed ? (
        <EmptyState
          title="Bulan ini masih berjalan"
          description={`Analisis ${month ? formatMonthDisplay(month) : ''} bisa dibuat mulai ${month ? formatDate(getMonthCloseDate(month)) : ''}, setelah semua transaksi bulan ini tercatat.`}
          icon={<CalendarClock size={24} />}
          actionText="Catat Transaksi"
          onActionClick={() => router.push('/transaction/new')}
        />
      ) : loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>AI sedang menganalisis keuangan Anda...</p>
        </div>
      ) : error ? (
        <EmptyState
          title="Analisis gagal dibuat"
          description={error}
          icon={<AlertTriangle size={24} />}
          actionText="Coba Lagi"
          onActionClick={load}
        />
      ) : isEmpty || !data ? (
        <EmptyState
          title="Belum ada yang bisa dianalisis"
          description={`Catat transaksi terlebih dahulu untuk ${month ? formatMonthDisplay(month) : 'bulan ini'}, lalu kembali ke sini untuk melihat kesimpulan AI.`}
          icon={<Receipt size={24} />}
          actionText="Catat Transaksi"
          onActionClick={() => router.push('/transaction/new')}
        />
      ) : (
        <div className={styles.content}>
          {/* AI monthly summary card */}
          <Card className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <Sparkles size={18} className={styles.sparkleIcon} />
              <span className={styles.summaryLabel}>Kesimpulan AI</span>
            </div>
            <p className={styles.summaryText}>{data.summary}</p>
          </Card>

          {/* Key Insights Lists */}
          <div className={styles.insightsList}>
            <h4 className={styles.sectionTitle}>Poin Penting Analisis</h4>

            {(data.insights ?? []).map((insight, idx) => {
              const Icon = iconMap[insight.type] || Lightbulb;
              const color = colorMap[insight.type] || '#6B7280';

              return (
                <Card
                  key={idx}
                  variant="outline"
                  className={styles.insightCard}
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <div className={styles.insightHeader}>
                    <Icon size={16} style={{ color }} />
                    <span className={styles.insightTitle} style={{ color }}>
                      {insight.title}
                    </span>
                  </div>
                  <p className={styles.insightDesc}>{insight.description}</p>
                </Card>
              );
            })}
          </div>

          <div className={styles.footer}>
            <span className={styles.meta}>
              Dibuat {data.generated_at ? formatDate(data.generated_at) : ''}
            </span>
            <span className={styles.meta}>Gratis · tersimpan permanen</span>
          </div>
        </div>
      )}
    </div>
  );
}
