'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, GraphNew as BarChart3, Widget2 as Grid3X3, Wallet2 as Wallet, 
  Target, ClockCircle as Clock, Stars as Sparkles, Download, 
  Gift, Shield, User, Logout as LogOut, Global as Globe
} from '@solar-icons/react';
import { useTranslation } from '../../lib/i18n';
import { useAuthStore } from '../../store/auth';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { useToastStore } from '../../store/toast';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { signOut, user } = useAuthStore();
  const { isVip } = useFeatureAccess();
  const { showToast } = useToastStore();

  const menuItems = [
    { label: t('tabHome'), path: '/home', icon: Home },
    { label: t('tabStats'), path: '/stats', icon: BarChart3 },
    { label: t('wallet'), path: '/wallets', icon: Wallet },
    { label: t('budgetTitle'), path: '/budget', icon: Target },
    { label: t('tabCategories'), path: '/categories', icon: Grid3X3 },
    { label: 'Recurring', path: '/recurring', icon: Clock },
    { label: t('aiAssistant'), path: '/ai-assistant', icon: Sparkles, highlight: true },
    { label: t('exportTitle'), path: '/export', icon: Download, disabled: true },
    { label: t('referralTitle'), path: '/referral', icon: Gift, disabled: true },
    { label: t('securityTitle'), path: '/security', icon: Shield },
    { label: t('tabProfile'), path: '/profile', icon: User },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  const toggleLanguage = () => {
    setLocale(locale === 'id' ? 'en' : 'id');
  };

  return (
    <aside className={styles.sidebar}>
      {/* Brand Header */}
      <div className={styles.brand}>
        <div className={styles.logoSquare}>F</div>
        <div>
          <h1 className={styles.appName}>{t('appName')}</h1>
          <p className={styles.appTagline}>{t('appTagline')}</p>
        </div>
      </div>

      {/* User Info / VIP Banner */}
      <div className={styles.userCard}>
        <span className={styles.userName}>{user?.name}</span>
        {isVip ? (
          <span className={styles.vipBadge}>{t('vipBadge')}</span>
        ) : (
          <Link href="/upgrade" className={styles.upgradeLink}>
            {t('freeBadge')} - Upgrade
          </Link>
        )}
      </div>

      {/* Navigation List */}
      <nav className={styles.navigation}>
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          if (item.disabled) {
            return (
              <button
                key={idx}
                onClick={() => showToast('Fitur ini sedang dalam pengembangan.', 'info')}
                className={`${styles.menuLink} ${item.highlight ? styles.highlight : ''}`}
                style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', opacity: 0.55 }}
                type="button"
              >
                <Icon size={18} className={styles.icon} />
                <span>{item.label} <span style={{ fontSize: '10px', opacity: 0.8 }}>(Soon)</span></span>
              </button>
            );
          }

          return (
            <Link 
              key={idx} 
              href={item.path} 
              className={`${styles.menuLink} ${isActive ? styles.active : ''} ${item.highlight ? styles.highlight : ''}`}
            >
              <Icon size={18} className={styles.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className={styles.footer}>
        {/* Language switcher */}
        <button onClick={toggleLanguage} className={styles.footerBtn}>
          <Globe size={16} />
          <span>{locale === 'id' ? 'Bahasa Indonesia' : 'English'}</span>
        </button>

        {/* Sign Out */}
        <button onClick={handleSignOut} className={styles.logoutBtn}>
          <LogOut size={16} />
          <span>{t('logoutBtn')}</span>
        </button>
      </div>
    </aside>
  );
}
