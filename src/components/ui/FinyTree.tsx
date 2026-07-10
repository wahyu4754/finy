'use client';

import React from 'react';
import { Sparkles, Droplets } from 'lucide-react';
import styles from './FinyTree.module.css';

interface FinyTreeProps {
  streak: number;
  hasAddedToday: boolean;
  onWaterClick?: () => void;
}

export default function FinyTree({ streak, hasAddedToday, onWaterClick }: FinyTreeProps) {
  // Determine plant stage based on streak
  let stage = 0; // Seed
  let stageName = 'Biji Keberuntungan';
  let stageDesc = 'Catat transaksi hari ini untuk menyiram biji agar tumbuh!';

  if (streak === 1) {
    stage = 1; // Sprout
    stageName = 'Tunas Baru';
    stageDesc = 'Hebat! Tunas pertamamu telah tumbuh. Jaga streak-mu besok!';
  } else if (streak === 2) {
    stage = 2; // Growing Sapling
    stageName = 'Batang Muda';
    stageDesc = 'Pohonmu mulai berdaun. Catat lagi besok agar berbunga!';
  } else if (streak === 3) {
    stage = 3; // Flower Bud
    stageName = 'Kuncup Emas';
    stageDesc = 'Satu hari lagi sebelum pohonmu membuahkan koin emas!';
  } else if (streak >= 4) {
    stage = 4; // Golden Tree
    stageName = 'Pohon Koin Emas';
    stageDesc = 'Luar biasa! Pohonmu telah menghasilkan buah finansial kemakmuran!';
  }

  // Draw corresponding SVG based on stage
  const renderPlantSVG = () => {
    switch (stage) {
      case 1:
        // Sprout (Streak = 1)
        return (
          <svg viewBox="0 0 120 160" className={styles.svgPlant}>
            {/* Pot */}
            <path d="M35 120 L85 120 L75 150 L45 150 Z" fill="#7C2D12" />
            <rect x="30" y="112" width="60" height="8" rx="3" fill="#9A3412" />
            <ellipse cx="60" cy="112" rx="25" ry="3" fill="#451A03" />

            {/* Stem */}
            <path d="M60 112 Q58 80 50 65" stroke="#22C55E" strokeWidth="4" strokeLinecap="round" fill="none" />
            
            {/* Leaves */}
            <path d="M50 65 Q35 60 40 50 Q52 52 50 65 Z" fill="#4ADE80" />
            <path d="M56 85 Q72 80 70 70 Q58 78 56 85 Z" fill="#22C55E" />
          </svg>
        );
      case 2:
        // Growing Sapling (Streak = 2)
        return (
          <svg viewBox="0 0 120 160" className={styles.svgPlant}>
            {/* Pot */}
            <path d="M35 120 L85 120 L75 150 L45 150 Z" fill="#7C2D12" />
            <rect x="30" y="112" width="60" height="8" rx="3" fill="#9A3412" />
            <ellipse cx="60" cy="112" rx="25" ry="3" fill="#451A03" />

            {/* Main Stem */}
            <path d="M60 112 Q60 70 54 40" stroke="#15803D" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M57 75 Q40 60 36 50" stroke="#15803D" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M58 60 Q75 50 78 40" stroke="#15803D" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Leaves */}
            <path d="M54 40 Q40 32 44 20 Q58 24 54 40 Z" fill="#4ADE80" />
            <path d="M36 50 Q22 45 28 35 Q40 38 36 50 Z" fill="#22C55E" />
            <path d="M78 40 Q92 35 88 25 Q76 30 78 40 Z" fill="#22C55E" />
            <path d="M58 85 Q42 82 46 72 Q58 76 58 85 Z" fill="#166534" />
          </svg>
        );
      case 3:
        // Flower Bud (Streak = 3)
        return (
          <svg viewBox="0 0 120 160" className={styles.svgPlant}>
            {/* Pot */}
            <path d="M35 120 L85 120 L75 150 L45 150 Z" fill="#7C2D12" />
            <rect x="30" y="112" width="60" height="8" rx="3" fill="#9A3412" />
            <ellipse cx="60" cy="112" rx="25" ry="3" fill="#451A03" />

            {/* Main Stem */}
            <path d="M60 112 Q62 60 55 30" stroke="#15803D" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M59 80 Q40 65 32 55" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M60 60 Q80 45 84 35" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />

            {/* Leaves */}
            <path d="M32 55 Q18 50 24 40 Q36 43 32 55 Z" fill="#22C55E" />
            <path d="M84 35 Q98 30 94 20 Q82 25 84 35 Z" fill="#22C55E" />
            <path d="M59 90 Q42 85 45 75 Q58 80 59 90 Z" fill="#166534" />
            <path d="M60 80 Q78 78 76 68 Q64 72 60 80 Z" fill="#166534" />

            {/* Glowing Bud */}
            <circle cx="55" cy="30" r="12" fill="#FBBF24" opacity="0.3" className={styles.glowingCore} />
            <path d="M55 30 Q45 20 55 8 Q65 20 55 30 Z" fill="#F59E0B" />
            <path d="M55 30 Q50 22 55 14 Q60 22 55 30 Z" fill="#FBBF24" />
          </svg>
        );
      case 4:
        // Golden Tree (Streak >= 4)
        return (
          <svg viewBox="0 0 120 160" className={styles.svgPlant}>
            {/* Pot */}
            <path d="M35 120 L85 120 L75 150 L45 150 Z" fill="#7C2D12" />
            <rect x="30" y="112" width="60" height="8" rx="3" fill="#9A3412" />
            <ellipse cx="60" cy="112" rx="25" ry="3" fill="#451A03" />

            {/* Thick Trunk */}
            <path d="M60 112 Q64 70 54 28" stroke="#78350F" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M60 85 Q35 65 24 55" stroke="#78350F" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M60 65 Q85 50 94 40" stroke="#78350F" strokeWidth="5" strokeLinecap="round" fill="none" />

            {/* Lush Foliage */}
            <circle cx="54" cy="28" r="22" fill="#166534" />
            <circle cx="24" cy="55" r="16" fill="#15803D" />
            <circle cx="94" cy="40" r="18" fill="#15803D" />
            <circle cx="56" cy="45" r="24" fill="#22C55E" opacity="0.9" />

            {/* Glowing Golden Coins */}
            {/* Coin 1 */}
            <circle cx="48" cy="24" r="10" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" className={styles.spinningCoin} />
            <text x="48" y="28" fontStyle="bold" fontSize="10" textAnchor="middle" fill="#78350F" fontWeight="bold">$</text>
            
            {/* Coin 2 */}
            <circle cx="24" cy="52" r="8" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" className={styles.spinningCoinDelayed} />
            <text x="24" y="55" fontStyle="bold" fontSize="8" textAnchor="middle" fill="#78350F" fontWeight="bold">$</text>

            {/* Coin 3 */}
            <circle cx="90" cy="38" r="9" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" className={styles.spinningCoin} />
            <text x="90" y="42" fontStyle="bold" fontSize="9" textAnchor="middle" fill="#78350F" fontWeight="bold">$</text>
          </svg>
        );
      default:
        // Seed in soil (Streak = 0)
        return (
          <svg viewBox="0 0 120 160" className={styles.svgPlant}>
            {/* Pot */}
            <path d="M35 120 L85 120 L75 150 L45 150 Z" fill="#7C2D12" />
            <rect x="30" y="112" width="60" height="8" rx="3" fill="#9A3412" />
            
            {/* Soil */}
            <ellipse cx="60" cy="112" rx="25" ry="3" fill="#451A03" />
            <ellipse cx="60" cy="114" rx="20" ry="2" fill="#78350F" />
            
            {/* Seed */}
            <path d="M55 110 C55 102 65 102 65 110 Z" fill="#B45309" stroke="#78350F" strokeWidth="1" />
            
            {/* Small dry indicator / dust lines */}
            <line x1="30" y1="85" x2="35" y2="90" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <line x1="85" y1="80" x2="80" y2="85" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          </svg>
        );
    }
  };

  return (
    <div className={styles.gardenCard}>
      {/* Sparkles on full growth */}
      {stage === 4 && (
        <div className={styles.sparkleOverlay}>
          <Sparkles className={styles.sparkleIcon1} size={14} />
          <Sparkles className={styles.sparkleIcon2} size={16} />
          <Sparkles className={styles.sparkleIcon3} size={12} />
        </div>
      )}

      {/* Left Column: Interactive Plant Display */}
      <div className={styles.plantDisplay}>
        {renderPlantSVG()}
        <div className={styles.stageBadge}>{stageName}</div>
      </div>

      {/* Right Column: Information & Watering Action */}
      <div className={styles.plantInfo}>
        <h4 className={styles.cardTitle}>Kebun Finansial Finy</h4>
        <p className={styles.stageDescription}>{stageDesc}</p>
        
        <div className={styles.progressSection}>
          <div className={styles.progressBarWrapper}>
            <div className={styles.progressLabel}>
              <span>Status Siram Harian</span>
              <span className={hasAddedToday ? styles.textSuccess : styles.textWarning}>
                {hasAddedToday ? 'Sudah Disiram' : 'Belum Disiram'}
              </span>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                className={`${styles.progressBarFill} ${hasAddedToday ? styles.barSuccess : ''}`}
                style={{ width: hasAddedToday ? '100%' : '15%' }}
              ></div>
            </div>
          </div>
        </div>

        {/* Water Button */}
        <button 
          className={`${styles.waterBtn} ${hasAddedToday ? styles.waterBtnSuccess : ''}`}
          onClick={onWaterClick}
          disabled={hasAddedToday}
        >
          <Droplets size={16} />
          {hasAddedToday ? 'Pohon Segar! (Kembali Besok)' : 'Siram Pohon (Catat Transaksi)'}
        </button>
      </div>
    </div>
  );
}
