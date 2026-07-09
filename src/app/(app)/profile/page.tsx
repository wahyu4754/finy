'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  User, Wallet, Target, Clock, Gift, Shield, 
  Download, LogOut, ChevronRight, Crown, Globe, ArrowLeft
} from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useAuthStore } from '../../../store/auth';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { useToastStore } from '../../../store/toast';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './Profile.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { user, signOut, deleteAccount } = useAuthStore();
  const { isVip } = useFeatureAccess();
  const { showToast } = useToastStore();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
    showToast('Berhasil keluar akun', 'success');
  };

  const toggleLanguage = () => {
    const nextLocale = locale === 'id' ? 'en' : 'id';
    setLocale(nextLocale);
    showToast(`Language set to ${nextLocale === 'id' ? 'Bahasa Indonesia' : 'English'}`, 'success');
  };

  const handleDeleteAccount = async () => {
    if (confirm('Apakah Anda yakin ingin menghapus akun Anda secara permanen? Semua data transaksi, dompet, dan profil akan dihapus selamanya.')) {
      if (confirm('Konfirmasi terakhir: Anda akan kehilangan akses ke data keuangan Anda secara permanen. Apakah Anda benar-benar yakin?')) {
        const { error } = await deleteAccount();
        if (error) {
          showToast('Gagal menghapus akun', 'error');
        } else {
          showToast('Akun Anda berhasil dihapus.', 'success');
          router.replace('/sign-in');
        }
      }
    }
  };

  const menuItems = [
    { label: t('walletManageTitle'), path: '/wallets', icon: Wallet },
    { label: t('budgetTitle'), path: '/budget', icon: Target },
    { label: 'Transaksi Berulang (Recurring)', path: '/recurring', icon: Clock },
    { label: t('referralTitle'), path: '/referral', icon: Gift, disabled: true },
    { label: t('securityTitle'), path: '/security', icon: Shield },
    { label: t('exportTitle'), path: '/export', icon: Download, disabled: true },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('tabProfile')}</h2>
        <div style={{ width: 20 }} />
      </header>

      {/* User Card Info */}
      <Card className={styles.userCard}>
        <div className={styles.avatar}>
          {user?.name.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className={styles.userInfo}>
          <h3 className={styles.name}>{user?.name || 'User'}</h3>
          <p className={styles.email}>{user?.email}</p>
          <div className={styles.badgeRow}>
            {isVip ? (
              <Badge variant="default" className={styles.vipBadge}>
                <Crown size={10} style={{ marginRight: 4 }} />
                {t('vipBadge')}
              </Badge>
            ) : (
              <Badge variant="outline" className={styles.freeBadge}>
                {t('freeBadge')}
              </Badge>
            )}
            <Badge variant="info" className={styles.creditsBadge}>
              {user?.ai_credits || 0} Credits
            </Badge>
          </div>
        </div>
      </Card>

      {/* Pricing Upgrade Card Banner */}
      {!isVip && (
        <Link href="/upgrade">
          <Card variant="glass" className={styles.upgradeBanner}>
            <div className={styles.upgradeLeft}>
              <Crown size={20} className={styles.crownIcon} />
              <div>
                <h4 className={styles.upgradeTitle}>Upgrade ke Finy Pro</h4>
                <p className={styles.upgradeDesc}>Akses asisten AI, scan struk otomatis, custom kategori, dan lainnya!</p>
              </div>
            </div>
            <ChevronRight size={18} />
          </Card>
        </Link>
      )}

      {/* Settings Navigation List Menu */}
      <div className={styles.menuList}>
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          const content = (
            <Card 
              variant="outline" 
              className={`${styles.menuRow} ${item.disabled ? styles.disabledRow : ''}`}
            >
              <div className={styles.menuLeft}>
                <Icon size={18} className={styles.menuIcon} />
                <span className={styles.menuLabel}>
                  {item.label} {item.disabled && <span className={styles.comingSoon}>Coming Soon</span>}
                </span>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </Card>
          );

          if (item.disabled) {
            return (
              <button 
                key={idx} 
                onClick={() => showToast('Fitur ini sedang dalam pengembangan.', 'info')}
                className={styles.menuButtonLink}
                type="button"
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={idx} href={item.path}>
              {content}
            </Link>
          );
        })}
      </div>

      {/* Profile actions footer options */}
      <div className={styles.footerActions}>
        {/* Toggle Language settings */}
        <button onClick={toggleLanguage} className={styles.actionRow}>
          <div className={styles.menuLeft}>
            <Globe size={18} className={styles.menuIcon} />
            <span className={styles.menuLabel}>{t('languageSetting')}</span>
          </div>
          <span className={styles.languageText}>
            {locale === 'id' ? 'Bahasa Indonesia' : 'English'}
          </span>
        </button>

        {/* Sign Out */}
        <button onClick={handleSignOut} className={styles.actionRow}>
          <div className={styles.menuLeft}>
            <LogOut size={18} className={styles.logoutIcon} />
            <span className={styles.logoutText}>{t('logoutBtn')}</span>
          </div>
          <ChevronRight size={16} className={styles.chevron} />
        </button>

        {/* Delete Account */}
        <button onClick={handleDeleteAccount} className={styles.deleteBtn}>
          {t('deleteAccountBtn')}
        </button>
      </div>
    </div>
  );
}
