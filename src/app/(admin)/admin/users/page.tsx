import Link from 'next/link';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { listUsers, type UserFilter, type UserSortKey } from '../../../../lib/admin-users';
import AdminError from '../../../../components/admin/AdminError';
import Pagination from '../../../../components/admin/Pagination';
import UsersToolbar from '../../../../components/admin/UsersToolbar';
import VipBadge from '../../../../components/admin/VipBadge';
import Badge from '../../../../components/ui/Badge';
import { fmtDateTime, fmtNumber, initials } from '../../../../components/admin/format';
import styles from '../../../../components/admin/Admin.module.css';

export const dynamic = 'force-dynamic';

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vip', label: 'VIP' },
  { value: 'free', label: 'Free' },
  { value: 'trial', label: 'On trial' },
  { value: 'expired_vip', label: 'Lapsed' },
  { value: 'banned', label: 'Suspended' },
  { value: 'admins', label: 'Admins' },
];

const SORTS: { value: UserSortKey; label: string }[] = [
  { value: 'created_at', label: 'Joined' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'vip_until', label: 'VIP expiry' },
  { value: 'ai_credits', label: 'AI credits' },
];

const COLUMNS: { key: UserSortKey; label: string }[] = [
  { key: 'name', label: 'User' },
  { key: 'vip_until', label: 'Status' },
  { key: 'ai_credits', label: 'AI credits' },
  { key: 'vip_until', label: 'VIP until' },
  { key: 'created_at', label: 'Joined' },
];

interface PageProps {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    sort?: string;
    dir?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const filter = (FILTERS.find(f => f.value === sp.filter)?.value ?? 'all') as UserFilter;
  const sortKey = (SORTS.find(s => s.value === sp.sort)?.value ?? 'created_at') as UserSortKey;
  const sortDir = sp.dir === 'asc' ? 'asc' : 'desc';
  const search = sp.q ?? '';
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(sp.pageSize ?? '25', 10) || 25));

  let result: Awaited<ReturnType<typeof listUsers>>;
  try {
    result = await listUsers({ search, filter, sortKey, sortDir, page, pageSize });
  } catch (err) {
    return (
      <>
        <Header />
        <AdminError
          title="Could not load users"
          message={err instanceof Error ? err.message : String(err)}
        />
      </>
    );
  }

  // Any change to the query must reset to page 1, otherwise filtering from
  // page 5 of "all" lands on an empty page 5 of "vip".
  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filter !== 'all') params.set('filter', filter);
    if (sortKey !== 'created_at') params.set('sort', sortKey);
    if (sortDir === 'asc') params.set('dir', 'asc');
    if (nextPage > 1) params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));
    return `/admin/users?${params.toString()}`;
  };

  const sortHref = (key: UserSortKey) => {
    const nextDir = sortKey === key && sortDir === 'desc' ? 'asc' : 'desc';
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filter !== 'all') params.set('filter', filter);
    if (key !== 'created_at') params.set('sort', key);
    if (nextDir === 'asc') params.set('dir', 'asc');
    params.set('pageSize', String(pageSize));
    return `/admin/users?${params.toString()}`;
  };

  const totalPages = Math.max(1, Math.ceil(result.count / pageSize));
  const effectivePage = Math.min(page, totalPages);

  return (
    <>
      <Header />

      <UsersToolbar
        basePath="/admin/users"
        filters={FILTERS}
        sorts={SORTS}
        resultCount={result.count}
        search={search}
        filter={filter}
        sort={sortKey}
        dir={sortDir}
      />

      <div className={styles.tableWrap}>
        {result.rows.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No users match this view</div>
            <div className={styles.emptyBody}>
              {search
                ? `Nothing found for “${search}”. Try a shorter term, or clear the search.`
                : 'Try a different filter.'}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {COLUMNS.map((col, i) => {
                      const active = sortKey === col.key;
                      const Icon = active
                        ? sortDir === 'asc'
                          ? ArrowUp
                          : ArrowDown
                        : ChevronsUpDown;
                      return (
                        <th key={`${col.label}-${i}`}>
                          <Link
                            href={sortHref(col.key)}
                            className={`${styles.sortLink} ${active ? styles.sortActive : ''}`}
                          >
                            {col.label}
                            <Icon size={12} />
                          </Link>
                        </th>
                      );
                    })}
                    <th aria-label="Actions" />
                  </tr>
                </thead>

                <tbody>
                  {result.rows.map(user => (
                    <tr key={user.id}>
                      <td>
                        <Link href={`/admin/users/${user.id}`} className={styles.userCell}>
                          <span className={styles.userAvatar}>
                            {user.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.avatar_url} alt="" />
                            ) : (
                              initials(user.name, user.email)
                            )}
                          </span>
                          <span className={styles.userMeta}>
                            <span className={styles.userName}>
                              {user.name}
                              {user.is_admin && (
                                <Badge variant="outline" className={styles.inlineBadge}>
                                  admin
                                </Badge>
                              )}
                            </span>
                            <span className={styles.userEmail}>{user.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <VipBadge user={user} />
                      </td>
                      <td className={styles.mono}>{fmtNumber(user.ai_credits)}</td>
                      <td className={`${styles.mono} ${styles.muted}`}>
                        {fmtDateTime(user.vip_until)}
                      </td>
                      <td className={`${styles.mono} ${styles.muted}`}>
                        {fmtDateTime(user.created_at)}
                      </td>
                      <td>
                        <Link href={`/admin/users/${user.id}`} className={styles.chip}>
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={effectivePage}
              pageSize={pageSize}
              count={result.count}
              hrefFor={hrefFor}
            />
          </>
        )}
      </div>
    </>
  );
}

function Header() {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>Users</h1>
        <p className={styles.pageSub}>
          Search every account, then manage its subscription, credits and access.
        </p>
      </div>
    </div>
  );
}
