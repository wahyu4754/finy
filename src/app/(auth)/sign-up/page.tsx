'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, UserPlus, User } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useAuthStore } from '../../../store/auth';
import { useToastStore } from '../../../store/toast';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import styles from './SignUp.module.css';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: 4 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signUp } = useAuthStore();
  const { showToast } = useToastStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      showToast('Harap isi semua kolom', 'warning');
      return;
    }

    if (password.length < 6) {
      showToast('Kata sandi harus minimal 6 karakter', 'warning');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);

    if (error) {
      showToast(error.message || 'Gagal mendaftar. Silakan coba lagi.', 'error');
    } else {
      showToast('Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi.', 'success');
      router.replace('/sign-in');
    }
  };

  const handleGoogleLogin = () => {
    showToast('Masuk dengan Google (Placeholder)', 'info');
  };

  return (
    <Card className={styles.authCard}>
      {/* Brand Header */}
      <div className={styles.brand}>
        <div className={styles.logoSquare}>F</div>
        <h1 className={styles.title}>{t('signUpTitle')}</h1>
        <p className={styles.subtitle}>{t('signUpSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label={t('nameLabel')}
          type="text"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<User size={16} />}
          required
        />

        <Input
          label={t('emailLabel')}
          type="email"
          placeholder="yourname@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={16} />}
          required
        />

        <Input
          label={t('passwordLabel')}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock size={16} />}
          required
        />

        <Button 
          type="submit" 
          loading={loading} 
          icon={<UserPlus size={16} />} 
          fullWidth
        >
          {t('signUpBtn')}
        </Button>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerText}>{t('oauthDivider')}</span>
      </div>

      <Button 
        onClick={handleGoogleLogin} 
        variant="outline" 
        icon={<GoogleIcon />} 
        fullWidth
      >
        {t('oauthGoogle')}
      </Button>

      <div className={styles.footer}>
        <Link href="/sign-in" className={styles.footerLink}>
          {t('haveAccount')}
        </Link>
      </div>
    </Card>
  );
}
