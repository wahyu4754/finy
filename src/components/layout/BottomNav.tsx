'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, Plus, Grid3X3, User } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    { label: t('tabHome'), path: '/home', icon: Home },
    { label: t('tabStats'), path: '/stats', icon: BarChart3 },
    { label: '', path: '/transaction/new', icon: Plus, isFab: true },
    { label: t('tabCategories'), path: '/categories', icon: Grid3X3 },
    { label: t('tabProfile'), path: '/profile', icon: User },
  ];

  return (
    <nav className={styles.navBar}>
      {navItems.map((item, idx) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;

        if (item.isFab) {
          return (
            <Link key={idx} href={item.path} className={styles.fabWrapper}>
              <div className={styles.fabButton} aria-label="Add transaction">
                <Icon size={28} strokeWidth={2.5} />
              </div>
            </Link>
          );
        }

        return (
          <Link key={idx} href={item.path} className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
            <Icon size={20} className={styles.icon} />
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
