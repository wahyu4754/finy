'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePurchasesStore } from '../../../../store/purchases';
import { useToastStore } from '../../../../store/toast';
import { ShieldCheck, AltArrowLeft, CheckCircle, CloseCircle } from '@solar-icons/react';
import styles from './MockPayment.module.css';

function MockPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { simulateVipActivation } = usePurchasesStore();
  const { showToast } = useToastStore();

  const orderId = searchParams.get('order_id') || `FINY-MOCK-${Math.floor(Math.random() * 1000000)}`;
  const amount = Number(searchParams.get('amount')) || 15000;
  const plan = searchParams.get('plan') || 'annual';

  const handlePaySuccess = async () => {
    showToast('Memproses pembayaran Finpay...', 'info');
    await simulateVipActivation();
    showToast('Pembayaran Berhasil! Status VIP Anda telah aktif.', 'success');
    router.replace('/home');
  };

  const handlePayCancel = () => {
    showToast('Pembayaran dibatalkan.', 'error');
    router.replace('/upgrade');
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={handlePayCancel} className={styles.backBtn} aria-label="Cancel">
          <AltArrowLeft size={24} />
        </button>
        <div className={styles.logoContainer}>
          <span className={styles.fin}>fin</span>
          <span className={styles.pay}>pay</span>
          <span className={styles.pg}>PG</span>
        </div>
      </header>

      {/* Main Card */}
      <main className={styles.main}>
        <div className={styles.summaryCard}>
          <div className={styles.merchantInfo}>
            <span className={styles.merchantLabel}>Merchant</span>
            <span className={styles.merchantName}>Finy App Pro</span>
          </div>

          <div className={styles.divider} />

          <div className={styles.details}>
            <div className={styles.detailRow}>
              <span>Order ID</span>
              <strong className={styles.orderId}>{orderId}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Deskripsi</span>
              <span>Langganan Finy {plan === 'annual' ? 'Tahunan' : 'Bulanan'}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Total Pembayaran</span>
              <strong className={styles.amount}>
                Rp {amount.toLocaleString('id-ID')}
              </strong>
            </div>
          </div>

          <div className={styles.securityBadge}>
            <ShieldCheck size={16} />
            <span>Koneksi terenkripsi & aman oleh Finnet Indonesia</span>
          </div>
        </div>

        {/* Simulation Options */}
        <div className={styles.simulationCard}>
          <h2 className={styles.simTitle}>Simulasi Gerbang Pembayaran Finpay</h2>
          <p className={styles.simDesc}>
            Gunakan tombol interaktif di bawah untuk mensimulasikan respons pembayaran dari server Finpay.
          </p>

          <div className={styles.actionGroup}>
            <button 
              onClick={handlePaySuccess} 
              className={`${styles.btn} ${styles.btnSuccess}`}
            >
              <CheckCircle size={20} />
              <span>Simulasikan Sukses (Sukses Bayar)</span>
            </button>

            <button 
              onClick={handlePayCancel} 
              className={`${styles.btn} ${styles.btnCancel}`}
            >
              <CloseCircle size={20} />
              <span>Simulasikan Batal / Gagal</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px', color: '#fff' }}>Memuat halaman simulasi...</div>}>
      <MockPaymentContent />
    </Suspense>
  );
}
