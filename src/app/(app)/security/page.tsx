'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useSecurityStore } from '../../../store/security';
import { useToastStore } from '../../../store/toast';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import styles from './Security.module.css';

export default function SecurityPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { 
    isEnabled, 
    setPin, 
    disable,
    initialize 
  } = useSecurityStore();

  const [setupStep, setSetupStep] = useState<'idle' | 'enter' | 'confirm'>('idle');
  const [pinInput, setPinInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleToggle = () => {
    if (isEnabled) {
      if (confirm('Apakah Anda yakin ingin menonaktifkan Kunci PIN keamanan?')) {
        disable();
        showToast('Keamanan Kunci PIN dinonaktifkan.', 'info');
      }
    } else {
      setSetupStep('enter');
      setPinInput('');
      setConfirmInput('');
    }
  };

  const handleStepEnterNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length !== 6 || isNaN(Number(pinInput))) {
      showToast('PIN harus berupa 6 angka.', 'warning');
      return;
    }
    setSetupStep('confirm');
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput !== confirmInput) {
      showToast(t('securityPINMismatch'), 'error');
      setConfirmInput('');
      return;
    }

    setPin(pinInput);
    showToast('PIN Keamanan berhasil diaktifkan!', 'success');
    setSetupStep('idle');
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('securityTitle')}</h2>
        <div style={{ width: 24 }} />
      </header>

      {/* Lock Hero Indicator */}
      <div className={styles.hero}>
        <div className={`${styles.iconCircle} ${isEnabled ? styles.iconActive : ''}`}>
          {isEnabled ? <ShieldCheck size={32} /> : <Shield size={32} />}
        </div>
        <h3 className={styles.heroTitle}>Kunci PIN Aplikasi</h3>
        <p className={styles.heroSubtitle}>
          {isEnabled 
            ? 'Aplikasi Anda aman dengan proteksi PIN 6 angka.'
            : 'Aktifkan PIN untuk melindungi data keuangan Anda saat aplikasi dibuka.'
          }
        </p>
      </div>

      {setupStep === 'idle' ? (
        <div className={styles.settingsList}>
          <Card className={styles.settingRow} variant="outline">
            <div className={styles.settingLeft}>
              <Lock size={18} className={styles.settingIcon} />
              <div>
                <span className={styles.settingTitle}>{t('securityLockEnable')}</span>
                <p className={styles.settingDesc}>Minta verifikasi PIN saat aplikasi dibuka.</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={isEnabled} 
              onChange={handleToggle}
              className={styles.checkbox}
            />
          </Card>

          {isEnabled && (
            <button onClick={() => setSetupStep('enter')} className={styles.changePinBtn}>
              <KeyRound size={16} />
              <span>{t('securityChangePIN')}</span>
            </button>
          )}
        </div>
      ) : setupStep === 'enter' ? (
        <Card className={styles.formCard}>
          <h4 className={styles.formTitle}>{t('securityEnterPIN')}</h4>
          <form onSubmit={handleStepEnterNext} className={styles.form}>
            <Input
              type="password"
              placeholder="Masukkan 6 angka PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              maxLength={6}
              pattern="[0-9]*"
              inputMode="numeric"
              required
              autoFocus
              className={styles.pinInput}
            />
            <div className={styles.formButtons}>
              <Button onClick={() => setSetupStep('idle')} variant="ghost">
                {t('cancel')}
              </Button>
              <Button type="submit">
                Lanjut
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className={styles.formCard}>
          <h4 className={styles.formTitle}>{t('securityConfirmPIN')}</h4>
          <form onSubmit={handleConfirmSave} className={styles.form}>
            <Input
              type="password"
              placeholder="Ulangi 6 angka PIN"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              maxLength={6}
              pattern="[0-9]*"
              inputMode="numeric"
              required
              autoFocus
              className={styles.pinInput}
            />
            <div className={styles.formButtons}>
              <Button onClick={() => setSetupStep('enter')} variant="ghost">
                Kembali
              </Button>
              <Button type="submit">
                {t('save')}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
