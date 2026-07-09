'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, X, Download } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import Button from './Button';
import styles from './PWAInstallPrompt.module.css';

export default function PWAInstallPrompt() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // 1. Check if PWA is already running in standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
      
    if (isStandalone) return;

    // 2. Check if dismissed recently
    const dismissed = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissed === 'true') return;

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent;
    const iOS = !!ua.match(/iPad|iPhone|iPod/);
    const webkit = !!ua.match(/WebKit/);
    const Safari = iOS && webkit && !ua.match(/CriOS/);
    setIsSafari(Safari);

    // 4. Listen for Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS Safari, show prompt since custom event won't fire
    if (Safari) {
      // Delay slightly for smooth page load transition
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className={styles.banner}>
      <button onClick={handleDismiss} className={styles.closeBtn} aria-label="Dismiss prompt">
        <X size={16} />
      </button>

      <div className={styles.content}>
        <div className={styles.appIconSquare}>
          <Smartphone size={24} />
        </div>
        
        <div className={styles.textContainer}>
          <h4 className={styles.title}>Install {t('appName')}</h4>
          <p className={styles.subtitle}>
            {isSafari 
              ? 'Tap Share icon at the bottom then "Add to Home Screen"'
              : 'Tambahkan Finy ke layar utama ponsel Anda untuk akses cepat.'
            }
          </p>
        </div>
      </div>

      {!isSafari && deferredPrompt && (
        <Button onClick={handleInstallClick} size="sm" icon={<Download size={14} />} className={styles.btn}>
          Install
        </Button>
      )}
    </div>
  );
}
