import { AlertTriangle } from 'lucide-react';
import styles from './Admin.module.css';

/**
 * Shown instead of data when the CMS cannot reach Supabase with the
 * service-role key. States the fix rather than a bare stack trace, because a
 * missing env var is by far the most likely first-run failure.
 */
export default function AdminError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const isKeyProblem = /SERVICE_ROLE/i.test(message);

  return (
    <div className={styles.panel}>
      <div className={styles.emptyTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
        {title}
      </div>

      <p className={styles.emptyBody} style={{ marginTop: 8, lineHeight: 1.6, maxWidth: '70ch' }}>
        {message}
      </p>

      {isKeyProblem && (
        <div className={styles.noticeBanner} style={{ marginTop: 16 }}>
          <strong>To fix:</strong> Supabase → Project Settings → API → copy the{' '}
          <code>service_role</code> secret key, then add it as{' '}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env.local</code> and to Vercel →
          Settings → Environment Variables. Restart the dev server after changing{' '}
          <code>.env.local</code>. Never prefix it with <code>NEXT_PUBLIC_</code>.
        </div>
      )}
    </div>
  );
}
