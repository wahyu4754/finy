'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AltArrowLeft as ArrowLeft } from '@solar-icons/react';
import styles from './Clicker.module.css';

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  type: 'normal' | 'lucky' | 'rare';
}

export default function ClickerPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(1000);
  const [floatTexts, setFloatTexts] = useState<FloatingText[]>([]);
  const [piggyScale, setPiggyScale] = useState(1);

  // Load balance initially
  useEffect(() => {
    const savedBalance = localStorage.getItem('finy_game_balance');
    if (savedBalance) {
      setBalance(Number(savedBalance));
    }
  }, []);

  const updateBalance = (newVal: number) => {
    const rounded = Math.round(newVal * 100) / 100;
    setBalance(rounded);
    localStorage.setItem('finy_game_balance', String(rounded));
  };

  const playCoinSound = (type: 'coin' | 'jackpot') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'jackpot') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const handlePiggyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Squishy animation scale trigger
    setPiggyScale(0.9);
    setTimeout(() => setPiggyScale(1), 80);

    // Get click coordinates relative to the clicker area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Roll random chance prize
    const roll = Math.random() * 100;
    let earned = 0;
    let type: 'normal' | 'lucky' | 'rare' = 'normal';

    if (roll < 1) {
      // 1% Rare Jackpot: ₣1000 - ₣5000
      earned = Math.floor(Math.random() * 4001) + 1000;
      type = 'rare';
      playCoinSound('jackpot');
    } else if (roll < 10) {
      // 9% Lucky: ₣5 - ₣100
      earned = Math.floor(Math.random() * 96) + 5;
      type = 'lucky';
      playCoinSound('coin');
    } else {
      // 90% Normal: ₣1 - ₣20
      earned = Math.floor(Math.random() * 20) + 1;
      type = 'normal';
      playCoinSound('coin');
    }

    updateBalance(balance + earned);

    // Add floating text
    const textId = Date.now() + Math.random();
    const newText: FloatingText = {
      id: textId,
      text: `+₣${earned}`,
      x,
      y,
      type
    };

    setFloatTexts(prev => [...prev, newText]);

    // Cleanup text after 800ms
    setTimeout(() => {
      setFloatTexts(prev => prev.filter(t => t.id !== textId));
    }, 800);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Celengan Ketuk</h2>
        <div style={{ width: 20 }} />
      </header>

      {/* Shared Token Balance Display */}
      <div className={styles.balanceBar}>
        <span className={styles.balanceLabel}>SALDO TOKEN FINY</span>
        <span className={styles.balanceVal}>₣ {balance.toLocaleString('id-ID')}</span>
      </div>

      {/* Clicker Area */}
      <div 
        className={styles.clickerArea} 
        onClick={handlePiggyClick}
        style={{ transform: `scale(${piggyScale})` }}
      >
        {/* Vector Piggy Bank Illustration */}
        <svg viewBox="0 0 160 160" className={styles.piggySvg}>
          {/* Ears */}
          <polygon points="50,45 35,20 60,35" fill="#EC4899" stroke="#DB2777" strokeWidth="3" />
          <polygon points="110,45 125,20 100,35" fill="#EC4899" stroke="#DB2777" strokeWidth="3" />

          {/* Legs */}
          <rect x="52" y="125" width="20" height="25" rx="5" fill="#DB2777" />
          <rect x="88" y="125" width="20" height="25" rx="5" fill="#DB2777" />

          {/* Body */}
          <ellipse cx="80" cy="88" rx="56" ry="46" fill="#F472B6" stroke="#DB2777" strokeWidth="4" />

          {/* Coin Slot */}
          <rect x="73" y="48" width="14" height="6" rx="2" fill="#475569" />

          {/* Eyes */}
          <circle cx="58" cy="80" r="5" fill="#1E293B" />
          <circle cx="102" cy="80" r="5" fill="#1E293B" />
          <circle cx="56" cy="78" r="1.5" fill="#FFFFFF" />
          <circle cx="100" cy="78" r="1.5" fill="#FFFFFF" />

          {/* Snout */}
          <ellipse cx="80" cy="98" rx="16" ry="12" fill="#F43F5E" stroke="#E11D48" strokeWidth="3" />
          <circle cx="74" cy="98" r="2.5" fill="#881337" />
          <circle cx="86" cy="98" r="2.5" fill="#881337" />

          {/* Cheek Blush */}
          <circle cx="44" cy="92" r="6" fill="#FB7185" opacity="0.6" />
          <circle cx="116" cy="92" r="6" fill="#FB7185" opacity="0.6" />
        </svg>

        {/* Rendering Floating Texts */}
        {floatTexts.map((item) => (
          <span 
            key={item.id} 
            className={`${styles.floatingText} ${
              item.type === 'rare' ? styles.textRare : item.type === 'lucky' ? styles.textLucky : styles.textNormal
            }`}
            style={{ left: item.x, top: item.y }}
          >
            {item.text}
          </span>
        ))}
      </div>

      <div className={styles.instructions}>
        💡 <strong>Cara Bermain:</strong>
        <br />
        Ketuk celengan babi berkali-kali untuk mengumpulkan koin! 
        Setiap ketukan acak berkesempatan menghasilkan jackpot koin besar. Kumpulkan koin sebanyak-banyaknya untuk ditradingkan!
      </div>
    </div>
  );
}
