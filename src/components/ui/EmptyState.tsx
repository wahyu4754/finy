'use client';

import React from 'react';
import Button from './Button';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionText?: string;
  onActionClick?: () => void;
}

export default function EmptyState({
  title,
  description,
  icon,
  actionText,
  onActionClick,
}: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.iconContainer}>{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {actionText && onActionClick && (
        <Button onClick={onActionClick} variant="outline" size="sm" className={styles.btn}>
          {actionText}
        </Button>
      )}
    </div>
  );
}
