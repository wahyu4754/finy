'use client';

import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'outline' | 'glass';
  style?: React.CSSProperties;
}

export default function Card({ children, className = '', onClick, variant = 'default', style }: CardProps) {
  const cardClass = `${styles.card} ${styles[variant]} ${onClick ? styles.clickable : ''} ${className}`;
  
  return (
    <div className={cardClass} onClick={onClick} style={style}>
      {children}
    </div>
  );
}
