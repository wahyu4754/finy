'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gift, Copy, Check, Users, Sparkles, Star } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useReferralStore } from '../../../store/referral';
import { useToastStore } from '../../../store/toast';
import { useAuthStore } from '../../../store/auth';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import styles from './Referral.module.css';

export default function ReferralPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { user } = useAuthStore();
  const { 
    stats, 
    fetchStats, 
    generateCode, 
    applyCode, 
    redeemVoucher, 
    loading 
  } = useReferralStore();

  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCopy = () => {
    if (!stats?.code) return;
    navigator.clipboard.writeText(stats.code);
    setCopied(true);
    showToast('Kode referral berhasil disalin!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      showToast('Masukkan kode referral teman', 'warning');
      return;
    }

    setSubmitting(true);
    const { error } = await applyCode(inputCode.trim());
    setSubmitting(false);

    if (error) {
      showToast(error.message || 'Gagal menerapkan kode', 'error');
    } else {
      showToast('Kode referral berhasil digunakan!', 'success');
      setInputCode('');
    }
  };

  const handleRedeem = async () => {
    setSubmitting(true);
    const { error, vip_until } = await redeemVoucher();
    setSubmitting(false);

    if (error) {
      showToast('Gagal mencairkan voucher', 'error');
    } else {
      showToast('Selamat! Akun Anda aktif Finy Pro selama 1 bulan!', 'success');
    }
  };

  const progressPercent = stats ? Math.min((stats.subscribed / 3) * 100, 100) : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('referralTitle')}</h2>
        <div style={{ width: 24 }} />
      </header>

      {/* Hero Badge Banner */}
      <Card variant="glass" className={styles.heroCard}>
        <Gift size={32} className={styles.giftIcon} />
        <h3 className={styles.heroTitle}>Ajak Teman, Dapat Reward!</h3>
        <p className={styles.heroSubtitle}>
          Bagikan Finy ke temanmu. Dapatkan kredit AI gratis dan klaim **1 Bulan Finy Pro gratis** setelah 3 teman berlangganan.
        </p>
      </Card>

      {/* Your Code display */}
      <Card className={styles.codeCard}>
        <span className={styles.codeLabel}>{t('referralCode')}</span>
        <div className={styles.codeRow}>
          <span className={styles.codeText}>{stats?.code || 'FINYWEB3'}</span>
          <button onClick={handleCopy} className={styles.copyBtn} aria-label="copy code">
            {copied ? <Check size={18} className={styles.checkIcon} /> : <Copy size={18} />}
          </button>
        </div>
      </Card>

      {/* VIP Voucher Redemption */}
      {stats?.has_voucher && (
        <Card className={styles.voucherCard}>
          <div className={styles.voucherLeft}>
            <Star size={24} className={styles.starIcon} fill="currentColor" />
            <div>
              <h4 className={styles.voucherTitle}>Voucher Finy Pro Siap Diklaim</h4>
              <p className={styles.voucherDesc}>Anda telah mencapai target referral. Klik klaim untuk mengaktifkan VIP.</p>
            </div>
          </div>
          <Button onClick={handleRedeem} loading={submitting} size="sm">
            Klaim
          </Button>
        </Card>
      )}

      {/* Milestone Progress Bar */}
      <Card className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Target Langganan Referral</span>
          <span className={styles.progressValue}>
            <strong>{stats?.subscribed || 0}</strong> / 3 teman
          </span>
        </div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <p className={styles.progressDesc}>{t('referralRewardNotice')}</p>
      </Card>

      {/* Referral Stats Column Metrics */}
      <div className={styles.statsRow}>
        <Card variant="outline" className={styles.statBox}>
          <Users size={18} />
          <span className={styles.statLabel}>Undangan</span>
          <span className={styles.statValue}>{stats?.total || 0}</span>
        </Card>

        <Card variant="outline" className={styles.statBox}>
          <Star size={18} />
          <span className={styles.statLabel}>Subscribed</span>
          <span className={styles.statValue}>{stats?.subscribed || 0}</span>
        </Card>

        <Card variant="outline" className={styles.statBox}>
          <Sparkles size={18} />
          <span className={styles.statLabel}>AI Credits</span>
          <span className={styles.statValue}>{stats?.credits || 0}</span>
        </Card>
      </div>

      {/* Friend code input form */}
      {!user?.referred_by_code && (
        <Card className={styles.inputCard}>
          <h4 className={styles.inputTitle}>{t('referralInputPlaceholder')}</h4>
          <form onSubmit={handleApply} className={styles.inputForm}>
            <Input
              type="text"
              placeholder="KODE8KAR"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              maxLength={8}
              required
              className={styles.inputField}
            />
            <Button type="submit" loading={submitting}>
              {t('referralApplyBtn')}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
