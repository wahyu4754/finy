'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ScrollText,
  LogOut,
  Shield,
  Menu,
  X,
  ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import type { AdminUser } from '../../lib/admin-auth';
import styles from './AdminShell.module.css';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users, exact: false },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText, exact: false },
];

interface AdminShellProps {
  admin: AdminUser;
  children: React.ReactNode;
}

export default function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useAuthStore(s => s.signOut);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/sign-in');
  };

  const nav = (
    <>
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <Shield size={18} />
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>Finy</span>
          <span className={styles.brandSub}>Admin CMS</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileNavOpen(false)}
            className={`${styles.navItem} ${isActive(href, exact) ? styles.navItemActive : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.navFooter}>
        <Link href="/home" className={styles.navItem}>
          <ArrowLeft size={18} />
          <span>Back to app</span>
        </Link>

        <div className={styles.adminCard}>
          <div className={styles.avatar}>
            {admin.name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.adminMeta}>
            <span className={styles.adminName}>{admin.name}</span>
            <span className={styles.adminEmail}>{admin.email}</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.signOutBtn}
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut size={16} />
          <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>{nav}</aside>

      {mobileNavOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileNavOpen(false)}>
          <aside className={styles.mobileSidebar} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className={styles.mobileClose}
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className={styles.topbarTitle}>
            {NAV_ITEMS.find(n => isActive(n.href, n.exact))?.label ?? 'Admin'}
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
