'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AltArrowLeft as ArrowLeft, AltArrowRight as ChevronRight } from '@solar-icons/react';
import styles from './Tools.module.css';

export default function ToolsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(1000);

  // Load balance initially to display at the top
  useEffect(() => {
    const savedBalance = localStorage.getItem('finy_game_balance');
    if (savedBalance) {
      setBalance(Number(savedBalance));
    } else {
      localStorage.setItem('finy_game_balance', '1000');
    }
  }, []);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Finy Tools & Games</h2>
        <div style={{ width: 20 }} />
      </header>

      {/* Shared Token Balance Display */}
      <div className={styles.balanceBar}>
        <span className={styles.balanceLabel}>SALDO TOKEN FINY</span>
        <span className={styles.balanceVal}>₣ {balance.toLocaleString('id-ID')}</span>
      </div>

      {/* Tools Menu Cards */}
      <div className={styles.menuGrid}>
        {/* Card 1: Idle Piggy Clicker */}
        <Link href="/tools/clicker" className={styles.toolCard}>
          <div className={styles.iconWrapper}>🐷</div>
          <div className={styles.cardContent}>
            <h3 className={styles.cardTitle}>Celengan Ketuk Virtual</h3>
            <p className={styles.cardDesc}>
              Ketuk celengan babi untuk mengumpulkan token! Dapatkan koin bonus hingga rare jackpot ₣5000.
            </p>
          </div>
          <ChevronRight size={18} />
        </Link>

        {/* Card 2: Trading Simulator */}
        <Link href="/tools/trading" className={styles.toolCard}>
          <div className={styles.iconWrapper}>📈</div>
          <div className={styles.cardContent}>
            <h3 className={styles.cardTitle}>Simulasi Trading Aset</h3>
            <p className={styles.cardDesc}>
              Uji ketangkasan berspekulasi harga dengan saldo awal Anda. Ambil posisi beli/jual secara real-time.
            </p>
          </div>
          <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}
