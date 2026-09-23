import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Wallet, ListOrdered, Tags, PiggyBank, Repeat, Users2 } from 'lucide-react';
import { getUserDetail } from '../../../../../lib/admin-users';
import { listAuditLog } from '../../../../../lib/admin-audit';
import { getAdminUser } from '../../../../../lib/admin-auth';
import AdminError from '../../../../../components/admin/AdminError';
import UserActionPanel from '../../../../../components/admin/UserActionPanel';
import VipBadge from '../../../../../components/admin/VipBadge';
import Pagination from '../../../../../components/admin/Pagination';
import Badge from '../../../../../components/ui/Badge';
import {
  fmtDateTime,
  fmtIDR,
  fmtNumber,
  fmtRelative,
  initials,
  fmtChangeValue,
} from '../../../../../components/admin/format';
import styles from '../../../../../components/admin/Admin.module.css';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  active: 'success',
  pending: 'warning',
  expired: 'default',
  cancelled: 'default',
  failed: 'danger',
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ logPage?: string }>;
}

export default async function AdminUserDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const logPage = Math.max(1, Number.parseInt(sp.logPage ?? '1', 10) || 1);

  let user: Awaited<ReturnType<typeof getUserDetail>>;
  let history: Awaited<ReturnType<typeof listAuditLog>>;
  let adminId: string;

  try {
    const [detail, admin] = await Promise.all([getUserDetail(id), getAdminUser()]);
    if (!detail) notFound();
    if (!admin) notFound();

    user = detail;
    adminId = admin.id;
    history = await listAuditLog({ targetUserId: id, page: logPage, pageSize: 10 });
  } catch (err) {
    // notFound() throws its own sentinel — let it through.
    if (typeof err === 'object' && err !== null && 'digest' in err) throw err;
    return (
      <AdminError
        title="Could not load this user"
        message={err instanceof Error ? err.message : String(err)}
      />
    );
  }

  const facts = [
    { label: 'User ID', value: user.id, mono: true },
    { label: 'Email', value: user.email },
    { label: 'Joined', value: `${fmtDateTime(user.created_at)} (${fmtRelative(user.created_at)})` },
    { label: 'Trial ends', value: fmtDateTime(user.trial_ends_at) },
    { label: 'VIP until', value: user.vip_until ? fmtDateTime(user.vip_until) : 'Never subscribed' },
    { label: 'AI credits', value: fmtNumber(user.ai_credits), mono: true },
    { label: 'Current streak', value: `${fmtNumber(user.current_streak)} days`, mono: true },
    { label: 'Referral code used', value: user.referred_by_code ?? '—' },
    { label: 'Credits earned from referrals', value: fmtNumber(user.referral_credits_earned), mono: true },
    { label: 'RevenueCat ID', value: user.revenuecat_user_id ?? 'Web/PWA only' },
  ];

  const dataCounts = [
    { label: 'Transactions', value: user.stats.transactions, icon: ListOrdered },
    { label: 'Wallets', value: user.stats.wallets, icon: Wallet },
    { label: 'Categories', value: user.stats.categories, icon: Tags },
    { label: 'Budgets', value: user.stats.budgets, icon: PiggyBank },
    { label: 'Recurring rules', value: user.stats.recurringRules, icon: Repeat },
    { label: 'Users referred', value: user.referredUsers, icon: Users2 },
  ];

  const totalPaid = user.subscriptions
    .filter(s => s.status === 'active' || s.status === 'expired')
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

  const logHref = (page: number) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('logPage', String(page));
    const qs = params.toString();
    return qs ? `/admin/users/${user.id}?${qs}` : `/admin/users/${user.id}`;
  };

  return (
    <>
      <Link href="/admin/users" className={styles.backLink}>
        <ArrowLeft size={14} /> All users
      </Link>

      <div className={styles.pageHeader}>
        <div className={styles.userCell}>
          <span className={styles.userAvatar} style={{ width: 44, height: 44, fontSize: 17 }}>
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" />
            ) : (
              initials(user.name, user.email)
            )}
          </span>
          <div className={styles.userMeta}>
            <span className={styles.pageTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.name}
              {user.is_admin && <Badge variant="outline">admin</Badge>}
            </span>
            <span className={styles.pageSub}>{user.email}</span>
          </div>
        </div>

        <div className={styles.actionRow}>
          <VipBadge user={user} />
          {user.is_banned && <Badge variant="danger">Suspended</Badge>}
          {user.has_vip_voucher && <Badge variant="warning">VIP voucher</Badge>}
        </div>
      </div>

      <div className={styles.statGrid}>
        {dataCounts.map(({ label, value, icon: Icon }) => (
          <div key={label} className={styles.statCard}>
            <span className={styles.statLabel}>
              <Icon size={13} /> {label}
            </span>
            <span className={`${styles.statValue} ${styles.mono}`}>{fmtNumber(value)}</span>
          </div>
        ))}
      </div>

      <div className={styles.grid2}>
        <div>
          <section>
            <h2 className={styles.sectionTitle}>Account details</h2>
            <div className={styles.panel}>
              {facts.map(f => (
                <div key={f.label} className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>{f.label}</span>
                  <span className={`${styles.fieldValue} ${f.mono ? styles.mono : ''}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                Payment history
              </h2>
              <span className={styles.sectionLink}>
                Settled total: <strong className={styles.mono}>{fmtIDR(totalPaid)}</strong>
              </span>
            </div>

            <div className={styles.tableWrap}>
              {user.subscriptions.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyTitle}>No payments</div>
                  <div className={styles.emptyBody}>
                    This user has never started a checkout.
                  </div>
                </div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Paid</th>
                        <th>Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.subscriptions.map(sub => (
                        <tr key={sub.id}>
                          <td className={styles.mono} style={{ fontSize: 12 }}>
                            {sub.order_id}
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{sub.plan}</td>
                          <td className={styles.mono}>{fmtIDR(sub.amount)}</td>
                          <td>
                            <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'}>
                              {sub.status}
                            </Badge>
                          </td>
                          <td className={`${styles.mono} ${styles.muted}`}>
                            {sub.paid_at ? fmtDateTime(sub.paid_at) : '—'}
                          </td>
                          <td className={`${styles.mono} ${styles.muted}`}>
                            {fmtDateTime(sub.expires_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                Change history for this user
              </h2>
              <Link href="/admin/audit" className={styles.sectionLink}>
                All activity
              </Link>
            </div>

            <div className={styles.tableWrap}>
              {history.rows.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyTitle}>No changes yet</div>
                  <div className={styles.emptyBody}>
                    Edits made from this page are recorded here.
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <tbody>
                        {history.rows.map(entry => (
                          <tr key={entry.id}>
                            <td style={{ whiteSpace: 'normal', minWidth: 280 }}>
                              <span className={styles.actionTag}>{entry.action}</span>
                              <div className={styles.changeList} style={{ marginTop: 5 }}>
                                {Object.entries(entry.changes ?? {}).map(([key, change]) => (
                                  <span key={key} className={styles.changeItem}>
                                    <span className={styles.changeKey}>{key}</span>{' '}
                                    <span className={styles.changeFrom}>
                                      {fmtChangeValue(change?.from)}
                                    </span>{' '}
                                    →{' '}
                                    <span className={styles.changeTo}>
                                      {fmtChangeValue(change?.to)}
                                    </span>
                                  </span>
                                ))}
                                {entry.reason && (
                                  <span className={styles.changeItem}>
                                    <span className={styles.changeKey}>reason</span> {entry.reason}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={styles.muted}>{entry.admin_email ?? 'system'}</td>
                            <td className={styles.muted}>{fmtRelative(entry.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    page={logPage}
                    pageSize={10}
                    count={history.count}
                    hrefFor={logHref}
                  />
                </>
              )}
            </div>
          </section>
        </div>

        <UserActionPanel user={user} isSelf={adminId === user.id} />
      </div>
    </>
  );
}
