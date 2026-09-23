import type { Metadata } from 'next';
import { getAdminUser } from '../../../lib/admin-auth';
import { ServiceKeyMissingError } from '../../../lib/supabase-admin';
import AdminShell from '../../../components/admin/AdminShell';
import AdminNoAccess from '../../../components/admin/AdminNoAccess';
import AdminError from '../../../components/admin/AdminError';
import styles from '../../../components/admin/AdminGate.module.css';

export const metadata: Metadata = {
  title: 'Finy Admin',
  robots: { index: false, follow: false },
};

// Authorization must never be served from cache. cookies() in getAdminUser()
// already opts this into dynamic rendering; stating it explicitly keeps the
// intent intact if that call is ever refactored away.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await getAdminUser();
  } catch (err) {
    // Missing service key: show the fix rather than claiming the operator lacks
    // permission, which would send them chasing the wrong problem.
    if (err instanceof ServiceKeyMissingError) {
      return (
        <div className={styles.gateContainer}>
          <div style={{ width: '100%', maxWidth: 640 }}>
            <AdminError title="Admin CMS is not configured" message={err.message} />
          </div>
        </div>
      );
    }
    throw err;
  }

  if (!admin) return <AdminNoAccess />;

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
