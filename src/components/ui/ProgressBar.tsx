'use client';

import React, { useEffect, useState } from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
}

export default function ProgressBar({ value, max, color, height = 8 }: ProgressBarProps) {
  const [width, setWidth] = useState(0);

  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOverspent = value > max && max > 0;

  useEffect(() => {
    // Animate fill on mount/value change
    const timer = setTimeout(() => {
      setWidth(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const getBarColor = () => {
    if (color) return color;
    if (isOverspent) return 'var(--color-danger)';
    if (percentage >= 80) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  return (
    <div className={styles.track} style={{ height: `${height}px` }}>
      <div 
        className={styles.fill} 
        style={{ 
          width: `${width}%`,
          backgroundColor: getBarColor()
        }} 
      />
    </div>
  );
}
