import Link from 'next/link';
import { listAuditLog } from '../../../../lib/admin-audit';
import AdminError from '../../../../components/admin/AdminError';
import Pagination from '../../../../components/admin/Pagination';
import SearchBox from '../../../../components/admin/SearchBox';
import { fmtDateTime, fmtRelative, fmtChangeValue } from '../../../../components/admin/format';
import styles from '../../../../components/admin/Admin.module.css';

export const dynamic = 'force-dynamic';

/** Exactly the actions the CMS API can produce (see api/admin/users/[id]). */
const ACTIONS = [
  { value: '', label: 'All' },
  { value: 'user.update', label: 'Profile edits' },
  { value: 'user.vip.grant', label: 'VIP granted' },
  { value: 'user.vip.set_until', label: 'VIP expiry set' },
  { value: 'user.vip.revoke', label: 'VIP revoked' },
  { value: 'user.ban', label: 'Suspended' },
  { value: 'user.unban', label: 'Restored' },
  { value: 'user.delete', label: 'Deleted' },
];

interface PageProps {
  searchParams: Promise<{ q?: string; action?: string; page?: string }>;
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = sp.q ?? '';
  const action = ACTIONS.some(a => a.value === sp.action) ? (sp.action ?? '') : '';
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const pageSize = 25;

  let result: Awaited<ReturnType<typeof listAuditLog>>;
  try {
    result = await listAuditLog({
      search,
      action: action || undefined,
      page,
      pageSize,
    });
  } catch (err) {
    return (
      <>
        <Header />
        <AdminError
          title="Could not load the audit log"
          message={err instanceof Error ? err.message : String(err)}
        />
      </>
    );
  }

  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (action) params.set('action', action);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/admin/audit?${qs}` : '/admin/audit';
  };

  return (
    <>
      <Header />

      <div className={styles.toolbar}>
        <SearchBox
          basePath="/admin/audit"
          value={search}
          placeholder="Search by admin or target email…"
          preserve={{ action }}
        />

        <div className={styles.chips}>
          {ACTIONS.map(a => (
            <Link
              key={a.value || 'all'}
              href={hrefForWithAction(a.value, search)}
              className={`${styles.chip} ${action === a.value ? styles.chipActive : ''}`}
            >
              {a.label}
            </Link>
          ))}
        </div>

        <span className={`${styles.chip} ${styles.chipCount}`} style={{ cursor: 'default' }}>
          {result.count.toLocaleString('id-ID')} entries
        </span>
      </div>

      <div className={styles.tableWrap}>
        {result.rows.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No audit entries</div>
            <div className={styles.emptyBody}>
              {search || action
                ? 'Nothing matches this filter yet.'
                : 'Changes made in the CMS are recorded here automatically.'}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(entry => (
                    <tr key={entry.id}>
                      <td className={`${styles.mono} ${styles.muted}`} title={fmtDateTime(entry.created_at)}>
                        {fmtRelative(entry.created_at)}
                      </td>
                      <td>{entry.admin_email ?? <span className={styles.muted}>deleted admin</span>}</td>
                      <td>
                        <span className={styles.actionTag}>{entry.action}</span>
                      </td>
                      <td>
                        {entry.target_user_id ? (
                          <Link
                            href={`/admin/users/${entry.target_user_id}`}
                            className={styles.userEmail}
                            style={{ color: 'var(--color-ink)' }}
                          >
                            {entry.target_user_email ?? entry.target_user_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className={styles.muted}>{entry.target_user_email ?? '—'}</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'normal', minWidth: 240, maxWidth: 460 }}>
                        <div className={styles.changeList}>
                          {Object.entries(entry.changes ?? {}).map(([key, change]) => (
                            <span key={key} className={styles.changeItem}>
                              <span className={styles.changeKey}>{key}</span>{' '}
                              <span className={styles.changeFrom}>{fmtChangeValue(change?.from)}</span>{' '}
                              → <span className={styles.changeTo}>{fmtChangeValue(change?.to)}</span>
                            </span>
                          ))}
                          {entry.reason && (
                            <span className={styles.changeItem}>
                              <span className={styles.changeKey}>reason</span> {entry.reason}
                            </span>
                          )}
                          {entry.ip_address && (
                            <span className={`${styles.changeItem} ${styles.muted}`}>
                              ip {entry.ip_address}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} pageSize={pageSize} count={result.count} hrefFor={hrefFor} />
          </>
        )}
      </div>
    </>
  );
}

function hrefForWithAction(action: string, search: string): string {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (action) params.set('action', action);
  const qs = params.toString();
  return qs ? `/admin/audit?${qs}` : '/admin/audit';
}

function Header() {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>Audit log</h1>
        <p className={styles.pageSub}>
          Append-only record of every change made through this CMS, including who made it and
          from which address.
        </p>
      </div>
    </div>
  );
}
