'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertTriangle, Lightbulb, Award } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import { useToastStore } from '../../../../store/toast';
import { generateMonthlyConclusion } from '../../../../lib/scanReceipt';
import { formatMonthDisplay } from '../../../../lib/format';
import { AIConclusion } from '../../../../types';
import Card from '../../../../components/ui/Card';
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

export default function InsightDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { month } = params;

  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const [data, setData] = useState<AIConclusion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConclusion = async () => {
      setLoading(true);
      try {
        const res = await generateMonthlyConclusion(month as string, {});
        setData(res);
      } catch (err) {
        showToast('Gagal memuat kesimpulan AI', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (month) {
      loadConclusion();
    }
  }, [month, showToast]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Analisis {formatMonthDisplay(month as string)}</h2>
        <div style={{ width: 24 }} />
      </header>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>AI sedang menganalisis keuangan Anda...</p>
        </div>
      ) : !data ? (
        <Card className={styles.emptyCard}>
          <p className={styles.emptyText}>Data analisis tidak tersedia.</p>
        </Card>
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
            
            {data.insights.map((insight, idx) => {
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
        </div>
      )}
    </div>
  );
}
