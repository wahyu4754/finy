'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Crown, Check, X, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useAuthStore } from '../../../store/auth';
import { usePurchasesStore } from '../../../store/purchases';
import { useToastStore } from '../../../store/toast';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import styles from './Upgrade.module.css';

export default function UpgradePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { createSubscription, loading, checkVipStatus, verifyPayment } = usePurchasesStore();
  const { fetchProfile } = useAuthStore();
  
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

  const handleSubscribe = async () => {
    showToast('Menghubungkan ke Midtrans...', 'info');
    
    const { error, snapToken, redirectUrl, orderId } = await createSubscription(selectedPlan);
    
    if (error) {
      showToast(typeof error === 'string' ? error : 'Gagal memproses transaksi. Coba lagi.', 'error');
      return;
    }
    
    if (!snapToken && !redirectUrl) {
      showToast('Gagal memproses sesi pembayaran.', 'error');
      return;
    }

    // Try Midtrans Snap Popup first
    if (typeof window !== 'undefined' && window.snap && snapToken) {
      window.snap.pay(snapToken, {
        onSuccess: async (result) => {
          console.log('Midtrans payment success:', result);
          showToast('Pembayaran berhasil! Mengaktifkan Finy Pro...', 'info');
          const targetOrderId = result.order_id || orderId;

          let confirmed = false;
          if (targetOrderId) {
            for (const delay of [1000, 3000, 5000]) {
              const res = await verifyPayment(targetOrderId);
              if (res.isVip) { confirmed = true; break; }
              await new Promise(r => setTimeout(r, delay));
            }
          }

          await fetchProfile();
          await checkVipStatus();

          if (confirmed) {
            showToast('Selamat! Finy Pro aktif.', 'success');
          } else {
            showToast('Pembayaran diterima. Status VIP akan aktif segera setelah verifikasi selesai.', 'info');
          }
          router.push('/home');
        },
        onPending: async (result) => {
          console.log('Midtrans payment pending:', result);
          const targetOrderId = result.order_id || orderId;
          if (targetOrderId) {
            await verifyPayment(targetOrderId);
          }
          await checkVipStatus();
          showToast('Pembayaran menunggu penyelesaian.', 'info');
          router.push('/home');
        },
        onError: (result) => {
          console.error('Midtrans payment error:', result);
          showToast('Pembayaran gagal atau ditolak.', 'error');
        },
        onClose: () => {
          showToast('Jendela pembayaran ditutup.', 'info');
        },
      });
    } else if (redirectUrl) {
      // Fallback to Midtrans hosted redirect
      showToast('Membuka halaman pembayaran Midtrans...', 'info');
      if (redirectUrl.startsWith('/')) {
        router.push(redirectUrl);
      } else {
        window.location.href = redirectUrl;
      }
    } else {
      showToast('Gagal memuat pembayaran Midtrans.', 'error');
    }
  };

  const features = [
    { name: 'Catatan Transaksi Harian', free: true, pro: true },
    { name: 'Kategori Kustom Baru', free: false, pro: true },
    { name: 'Dompet Terpisah (Multi-wallets)', free: false, pro: true },
    { name: 'Atur Anggaran per Kategori', free: false, pro: true },
    { name: 'Pengeluaran Berulang (Recurring)', free: false, pro: true },
    { name: 'Asisten AI Obrolan Tanpa Batas', free: false, pro: true },
    { name: 'Ekspor Data Laporan (CSV/PDF)', free: false, pro: true },
    { name: 'Backup Cloud Sinkronisasi Realtime', free: false, pro: true },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Finy Pro</h2>
        <div style={{ width: 24 }} />
      </header>

      {/* Hero Badge */}
      <div className={styles.hero}>
        <div className={styles.logoCircle}>
          <Crown size={32} />
        </div>
        <h3 className={styles.heroTitle}>Unlock Finy Pro</h3>
        <p className={styles.heroSubtitle}>Kelola keuangan cerdas tanpa batasan.</p>
      </div>

      {/* Plan Selector */}
      <div className={styles.plans}>
        {/* Annual Plan */}
        <Card 
          onClick={() => setSelectedPlan('annual')}
          className={`${styles.planCard} ${selectedPlan === 'annual' ? styles.planActive : ''}`}
          variant="outline"
        >
          <div className={styles.planBadge}>Hemat 33%</div>
          <span className={styles.planName}>Tahunan (Annual)</span>
          <h4 className={styles.planPrice}>
            Rp 119.999<span className={styles.pricePeriod}>/tahun</span>
          </h4>
          <span className={styles.equivalentPrice}>
            Setara Rp 10.000 / bulan
          </span>
        </Card>

        {/* Monthly Plan */}
        <Card 
          onClick={() => setSelectedPlan('monthly')}
          className={`${styles.planCard} ${selectedPlan === 'monthly' ? styles.planActive : ''}`}
          variant="outline"
        >
          <span className={styles.planName}>Bulanan (Monthly)</span>
          <h4 className={styles.planPrice}>
            Rp 14.999<span className={styles.pricePeriod}>/bulan</span>
          </h4>
          <span className={styles.equivalentPrice}>
            Bayar per bulan, batalkan kapan saja
          </span>
        </Card>
      </div>

      {/* Feature Comparison Matrix */}
      <Card className={styles.comparisonCard}>
        <h4 className={styles.compTitle}>Perbandingan Fitur</h4>
        <div className={styles.compList}>
          {features.map((f, idx) => (
            <div key={idx} className={styles.compRow}>
              <span className={styles.featureName}>{f.name}</span>
              <div className={styles.checks}>
                <div className={styles.checkCol}>
                  {f.free ? (
                    <Check size={16} className={styles.checkYes} />
                  ) : (
                    <X size={16} className={styles.checkNo} />
                  )}
                </div>
                <div className={styles.checkCol}>
                  <Check size={16} className={styles.checkYesPro} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Midtrans payment billing details */}
      <div className={styles.billingCard}>
        <ShieldCheck size={16} className={styles.shieldIcon} />
        <span>Pembayaran aman via Midtrans (QRIS, GoPay, Transfer Bank, Kartu)</span>
      </div>

      {/* CTA Button */}
      <Button 
        onClick={handleSubscribe} 
        loading={loading}
        size="lg" 
        fullWidth
        className={styles.ctaBtn}
      >
        Bayar Sekarang
      </Button>
    </div>
  );
}
