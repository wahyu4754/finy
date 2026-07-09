'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, GraphNew as BarChart3, AddCircle as Plus, Widget2 as Grid3X3, User } from '@solar-icons/react';
import { useTranslation } from '../../lib/i18n';
import { useTransactionStore } from '../../store/transactions';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { setAddTxOpen } = useTransactionStore();

  const navItems = [
    { label: t('tabHome'), path: '/home', icon: Home },
    { label: t('tabStats'), path: '/stats', icon: BarChart3 },
    { label: '', onClick: () => setAddTxOpen(true), icon: Plus, isFab: true },
    { label: t('tabCategories'), path: '/categories', icon: Grid3X3 },
    { label: t('tabProfile'), path: '/profile', icon: User },
  ];

  return (
    <nav className={styles.navBar}>
      {navItems.map((item, idx) => {
        const Icon = item.icon;
        
        if (item.isFab) {
          return (
            <button 
              key={idx} 
              onClick={item.onClick} 
              className={styles.fabButton} 
              aria-label="Add transaction"
              type="button"
            >
              <Icon size={22} strokeWidth={2.5} />
            </button>
          );
        }

        const isActive = pathname === item.path;

        return (
          <Link 
            key={idx} 
            href={item.path || '#'} 
            className={`${styles.navItem} ${isActive ? styles.active : styles.inactive}`}
          >
            <Icon size={20} className={styles.icon} />
            {isActive && <span className={styles.label}>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
