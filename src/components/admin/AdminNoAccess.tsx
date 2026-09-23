'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import Button from '../ui/Button';
import styles from './AdminGate.module.css';

/**
 * Rendered by the admin layout when the signed-in account is not an admin.
 * Deliberately vague: it must not confirm that /admin exists to a non-admin
 * probing the app, and must not leak which condition failed.
 */
export default function AdminNoAccess() {
  const router = useRouter();
  const signOut = useAuthStore(s => s.signOut);
  const session = useAuthStore(s => s.session);

  return (
    <div className={styles.gateContainer}>
      <div className={styles.gateCard}>
        <div className={styles.gateIcon}>
          <ShieldAlert size={28} />
        </div>

        <h1 className={styles.gateTitle}>Access denied</h1>

        <p className={styles.gateBody}>
          {session
            ? 'This account does not have administrator privileges.'
            : 'Sign in with an administrator account to continue.'}
        </p>

        <div className={styles.gateActions}>
          {session ? (
            <>
              <Button variant="outline" onClick={() => router.replace('/home')}>
                Back to app
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await signOut();
                  router.replace('/sign-in');
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button onClick={() => router.replace('/sign-in')}>Go to sign in</Button>
          )}
        </div>
      </div>
    </div>
  );
}
