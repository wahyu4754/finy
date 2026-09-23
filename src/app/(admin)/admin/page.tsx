import Link from 'next/link';
import {
  Users,
  Crown,
  Ban,
  ShieldCheck,
  UserPlus,
  CircleDollarSign,
  ArrowRight,
} from 'lucide-react';
import { getDashboardStats, listUsers, type DashboardStats } from '../../../lib/admin-users';
import { listAuditLog, type AuditEntry } from '../../../lib/admin-audit';
import AdminError from '../../../components/admin/AdminError';
import VipBadge from '../../../components/admin/VipBadge';
import { fmtIDR, fmtNumber, fmtRelative, initials, fmtChangeValue } from '../../../components/admin/format';
import styles from '../../../components/admin/Admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  let stats: DashboardStats;
  let newest: Awaited<ReturnType<typeof listUsers>>['rows'] = [];
  let recentAudit: AuditEntry[] = [];

  try {
    const [s, n, a] = await Promise.all([
      getDashboardStats(),
      listUsers({ sortKey: 'created_at', sortDir: 'desc', pageSize: 6 }),
      listAuditLog({ pageSize: 8 }),
    ]);
    stats = s;
    newest = n.rows;
    recentAudit = a.rows;
  } catch (err) {
    return (
      <>
        <Header />
        <AdminError
          title="Could not load dashboard data"
          message={err instanceof Error ? err.message : String(err)}
        />
      </>
    );
  }

  const cards = [
    {
      label: 'Total users',
      value: fmtNumber(stats.totalUsers),
      hint: `${fmtNumber(stats.newUsers30d)} joined in the last 30 days`,
      icon: Users,
      accent: true,
    },
    {
      label: 'VIP subscribers',
      value: fmtNumber(stats.vipUsers),
      hint:
        stats.totalUsers > 0
          ? `${((stats.vipUsers / stats.totalUsers) * 100).toFixed(1)}% conversion`
          : 'No users yet',
      icon: Crown,
    },
    {
      label: 'Revenue (settled)',
      value: fmtIDR(stats.revenue),
      hint: `${fmtNumber(stats.activeSubscriptions)} active · ${fmtNumber(stats.pendingSubscriptions)} pending`,
      icon: CircleDollarSign,
    },
    {
      label: 'New this week',
      value: fmtNumber(stats.newUsers7d),
      hint: `${fmtNumber(stats.newUsers30d)} this month`,
      icon: UserPlus,
    },
    {
      label: 'Suspended',
      value: fmtNumber(stats.bannedUsers),
      hint: 'Blocked at the edge on every request',
      icon: Ban,
    },
    {
      label: 'Administrators',
      value: fmtNumber(stats.admins),
      hint: 'Accounts with CMS access',
      icon: ShieldCheck,
    },
  ];

  return (
    <>
      <Header />

      <div className={styles.statGrid}>
        {cards.map(({ label, value, hint, icon: Icon, accent }) => (
          <div key={label} className={`${styles.statCard} ${accent ? styles.statAccent : ''}`}>
            <span className={styles.statLabel}>
              <Icon size={13} /> {label}
            </span>
            <span className={`${styles.statValue} ${styles.mono}`}>{value}</span>
            <span className={styles.statHint}>{hint}</span>
          </div>
        ))}
      </div>

      <div className={styles.grid2}>
        <section>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              Newest users
            </h2>
            <Link href="/admin/users" className={styles.sectionLink}>
              View all <ArrowRight size={13} />
            </Link>
          </div>

          <div className={styles.tableWrap}>
            {newest.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>No users yet</div>
                <div className={styles.emptyBody}>Signups will appear here.</div>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <tbody>
                    {newest.map(u => (
                      <tr key={u.id}>
                        <td>
                          <Link href={`/admin/users/${u.id}`} className={styles.userCell}>
                            <span className={styles.userAvatar}>
                              {u.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatar_url} alt="" />
                              ) : (
                                initials(u.name, u.email)
                              )}
                            </span>
                            <span className={styles.userMeta}>
                              <span className={styles.userName}>{u.name}</span>
                              <span className={styles.userEmail}>{u.email}</span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <VipBadge user={u} />
                        </td>
                        <td className={styles.muted}>{fmtRelative(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              Recent admin activity
            </h2>
            <Link href="/admin/audit" className={styles.sectionLink}>
              Full log <ArrowRight size={13} />
            </Link>
          </div>

          <div className={styles.tableWrap}>
            {recentAudit.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>No changes recorded yet</div>
                <div className={styles.emptyBody}>
                  Every edit made in this CMS lands here automatically.
                </div>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <tbody>
                    {recentAudit.map(entry => (
                      <tr key={entry.id}>
                        <td style={{ whiteSpace: 'normal', minWidth: 260 }}>
                          <span className={styles.actionTag}>{entry.action}</span>
                          <div className={styles.changeList} style={{ marginTop: 5 }}>
                            {Object.entries(entry.changes ?? {})
                              .slice(0, 3)
                              .map(([key, change]) => (
                                <span key={key} className={styles.changeItem}>
                                  <span className={styles.changeKey}>{key}</span>{' '}
                                  <span className={styles.changeFrom}>
                                    {fmtChangeValue(change?.from)}
                                  </span>{' '}
                                  → <span className={styles.changeTo}>{fmtChangeValue(change?.to)}</span>
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className={styles.muted}>{entry.target_user_email ?? '—'}</td>
                        <td className={styles.muted}>{fmtRelative(entry.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Header() {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSub}>Users, subscriptions and revenue at a glance.</p>
      </div>
      <Link href="/admin/users" className={styles.chip}>
        Manage users <ArrowRight size={14} />
      </Link>
    </div>
  );
}
