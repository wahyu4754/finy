'use client';

import React from 'react';
import { Flame } from 'lucide-react';
import styles from './StreakBadge.module.css';

interface StreakBadgeProps {
  streak: number;
  onClick?: () => void;
}

export default function StreakBadge({ streak, onClick }: StreakBadgeProps) {
  const isActive = streak > 0;
  
  return (
    <div 
      className={`${styles.badge} ${isActive ? styles.active : styles.inactive}`}
      onClick={onClick}
    >
      <Flame 
        size={16} 
        className={`${styles.flame} ${isActive ? styles.flameActive : ''}`} 
        fill={isActive ? '#F97316' : 'transparent'} 
      />
      <span className={styles.count}>{streak}</span>
    </div>
  );
}
