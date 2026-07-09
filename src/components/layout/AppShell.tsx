'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { useSecurityStore } from '../../store/security';
import { useI18nStore, initI18n } from '../../lib/i18n';
import AppLock from '../AppLock';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import ToastContainer from '../ui/Toast';
import PWAInstallPrompt from '../ui/PWAInstallPrompt';
import NewTransactionModal from '../NewTransactionModal';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, initialized: authInitialized, loading: authLoading, initialize: initAuth } = useAuthStore();
  const { isLocked, initialized: secInitialized, initialize: initSec } = useSecurityStore();
  const [mounted, setMounted] = useState(false);

  // Initialize stores on mount
  useEffect(() => {
    setMounted(true);
    initI18n();
    initAuth();
    initSec();

    // Register PWA Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => console.log('Service Worker registered with scope:', reg.scope),
        (err) => console.warn('Service Worker registration failed:', err)
      );
    }
  }, [initAuth, initSec]);

  // Handle redirect checks
  useEffect(() => {
    if (!mounted || !authInitialized) return;

    const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up') || pathname.startsWith('/auth/callback');

    if (!user && !isAuthPage && !authLoading) {
      router.replace('/sign-in');
    } else if (user && isAuthPage) {
      router.replace('/home');
    }
  }, [user, authInitialized, authLoading, pathname, mounted, router]);

  if (!mounted || !authInitialized || !secInitialized) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  // If locked, render security overlay instead of the app
  if (isLocked) {
    return <AppLock />;
  }

  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up') || pathname.startsWith('/auth/callback');

  if (isAuthPage) {
    return (
      <div className={styles.authContainer}>
        <ToastContainer />
        {children}
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <ToastContainer />
      <NewTransactionModal />
      <div className={styles.desktopSidebar}>
        <Sidebar />
      </div>
      
      <div className={styles.mainLayout}>
        <main className={styles.content}>
          {children}
        </main>
        
        <PWAInstallPrompt />
        
        <div className={styles.mobileNav}>
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
