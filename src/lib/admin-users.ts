import { getAdminClient } from './supabase-admin';
import { requestMeta, sanitizeSearchTerm } from './admin-audit';
import type { AdminUser } from './admin-auth';

/**
 * Data access for the admin CMS. Everything here runs with the service-role
 * key, so every function must be reachable only from a Route Handler that has
 * already passed requireAdmin().
 */

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_vip: boolean;
  is_admin: boolean;
  is_banned: boolean;
  vip_until: string | null;
  trial_ends_at: string | null;
  ai_credits: number;
  has_vip_voucher: boolean;
  referred_by_code: string | null;
  referral_credits_earned: number;
  current_streak: number;
  last_transaction_date: string | null;
  revenuecat_user_id: string | null;
  created_at: string;
}

const USER_COLUMNS = `
  id, email, name, avatar_url, is_vip, is_admin, is_banned,
  vip_until, trial_ends_at, ai_credits, has_vip_voucher,
  referred_by_code, referral_credits_earned, current_streak,
  last_transaction_date, revenuecat_user_id, created_at
`;

export type UserFilter =
  | 'all'
  | 'vip'
  | 'free'
  | 'trial'
  | 'expired_vip'
  | 'banned'
  | 'admins';

export type UserSortKey = 'created_at' | 'name' | 'email' | 'vip_until' | 'ai_credits';

export interface ListUsersParams {
  search?: string;
  filter?: UserFilter;
  sortKey?: UserSortKey;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SORTABLE: UserSortKey[] = ['created_at', 'name', 'email', 'vip_until', 'ai_credits'];

export async function listUsers(
  params: ListUsersParams = {}
): Promise<{ rows: AdminUserRow[]; count: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 25));
  const sortKey = SORTABLE.includes(params.sortKey as UserSortKey)
    ? (params.sortKey as UserSortKey)
    : 'created_at';
  const ascending = params.sortDir === 'asc';

  let query = getAdminClient()
    .from('users')
    .select(USER_COLUMNS, { count: 'exact' });

  const search = sanitizeSearchTerm(params.search);
  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
  }

  const now = new Date().toISOString();
  switch (params.filter) {
    case 'vip':
      query = query.eq('is_vip', true);
      break;
    case 'free':
      query = query.eq('is_vip', false);
      break;
    case 'trial':
      query = query.eq('is_vip', false).gte('trial_ends_at', now);
      break;
    case 'expired_vip':
      query = query.eq('is_vip', false).not('vip_until', 'is', null).lt('vip_until', now);
      break;
    case 'banned':
      query = query.eq('is_banned', true);
      break;
    case 'admins':
      query = query.eq('is_admin', true);
      break;
  }

  // NULL vip_until sorts last in Postgres ascending, which reads as "never
  // subscribed" — fine for both directions here.
  const { data, error, count } = await query
    .order(sortKey, { ascending, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw new Error(`User list query failed: ${error.message}`);

  return { rows: (data ?? []) as AdminUserRow[], count: count ?? 0, page, pageSize };
}

export interface SubscriptionRow {
  id: string;
  order_id: string;
  plan: 'monthly' | 'annual';
  amount: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled' | 'failed';
  payment_type: string | null;
  midtrans_transaction_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ReferralUseRow {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  rewarded: boolean;
  created_at: string;
}

export interface UserDetail extends AdminUserRow {
  subscriptions: SubscriptionRow[];
  referredUsers: number;
  stats: {
    transactions: number;
    wallets: number;
    categories: number;
    budgets: number;
    recurringRules: number;
  };
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const admin = getAdminClient();

  const { data: user, error } = await admin
    .from('users')
    .select(USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(`User lookup failed: ${error.message}`);
  if (!user) return null;

  // Count-only queries in parallel; none of them transfer row data.
  const [subs, referred, tx, wallets, cats, budgets, recurring] = await Promise.all([
    admin
      .from('subscriptions')
      .select('id, order_id, plan, amount, status, payment_type, midtrans_transaction_id, paid_at, expires_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('referral_uses').select('id', { count: 'exact', head: true }).eq('referrer_id', userId),
    admin.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('wallets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('categories').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('budgets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('recurring_rules').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return {
    ...(user as AdminUserRow),
    subscriptions: (subs.data ?? []) as SubscriptionRow[],
    referredUsers: referred.count ?? 0,
    stats: {
      transactions: tx.count ?? 0,
      wallets: wallets.count ?? 0,
      categories: cats.count ?? 0,
      budgets: budgets.count ?? 0,
      recurringRules: recurring.count ?? 0,
    },
  };
}

/** Fields the CMS is allowed to write. Mirrors the whitelist in admin_manage_user(). */
export interface AllowedUserUpdates {
  name?: string;
  ai_credits?: number;
  trial_ends_at?: string | null;
  has_vip_voucher?: boolean;
  referral_credits_earned?: number;
  current_streak?: number;
  is_banned?: boolean;
}

export type VipAction =
  | { mode: 'grant'; days: number }
  | { mode: 'set_until'; until: string }
  | { mode: 'revoke' };

export interface ManageUserArgs {
  admin: AdminUser;
  targetId: string;
  updates?: AllowedUserUpdates;
  vip?: VipAction | null;
  action?: string;
  reason?: string | null;
  request?: Request;
}

export interface ManageUserResult {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changes: Record<string, { from: unknown; to: unknown }>;
}

/**
 * Apply a whitelisted update and/or a VIP change. Runs entirely inside the
 * admin_manage_user() RPC, so the users row, the subscriptions rows and the
 * audit entry commit together or not at all.
 */
export async function manageUser(args: ManageUserArgs): Promise<ManageUserResult> {
  const { ip, userAgent } = requestMeta(args.request);

  const { data, error } = await getAdminClient().rpc('admin_manage_user', {
    p_admin_id: args.admin.id,
    p_target_id: args.targetId,
    p_updates: args.updates ?? {},
    p_vip: args.vip ?? null,
    p_action: args.action ?? 'user.update',
    p_reason: args.reason ?? null,
    p_ip: ip,
    p_ua: userAgent,
  });

  if (error) throw new Error(error.message);
  return data as ManageUserResult;
}

export interface DashboardStats {
  totalUsers: number;
  vipUsers: number;
  bannedUsers: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  revenue: number;
  newUsers7d: number;
  newUsers30d: number;
  admins: number;
}

/**
 * Dashboard aggregates, computed by admin_dashboard_stats() in migration 020.
 *
 * Done in one RPC rather than client-side queries because config.toml caps any
 * single SELECT at max_rows = 1000 — summing revenue by fetching the amount
 * column would silently under-report once there are more than 1000 settled
 * payments. Counts are unaffected by the cap, but one round trip beats nine.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await getAdminClient().rpc('admin_dashboard_stats');

  if (error) throw new Error(`Stats query failed: ${error.message}`);

  const stats = data as Partial<DashboardStats> | null;

  return {
    totalUsers: Number(stats?.totalUsers ?? 0),
    vipUsers: Number(stats?.vipUsers ?? 0),
    bannedUsers: Number(stats?.bannedUsers ?? 0),
    admins: Number(stats?.admins ?? 0),
    newUsers7d: Number(stats?.newUsers7d ?? 0),
    newUsers30d: Number(stats?.newUsers30d ?? 0),
    activeSubscriptions: Number(stats?.activeSubscriptions ?? 0),
    pendingSubscriptions: Number(stats?.pendingSubscriptions ?? 0),
    revenue: Number(stats?.revenue ?? 0),
  };
}

/**
 * Permanently delete a user. Mirrors supabase/functions/delete-account, plus
 * the tables it omits (ai_conclusions, rate_limits, referral_codes).
 *
 * referral_claims_log is deliberately NOT touched: it is keyed on email and
 * must outlive the account, otherwise deleting and re-registering would reset
 * the referral abuse guard added in migration 013.
 */
export async function deleteUser(args: {
  admin: AdminUser;
  targetId: string;
  reason?: string | null;
  request?: Request;
}): Promise<void> {
  const admin = getAdminClient();
  const uid = args.targetId;

  const { data: target, error: lookupErr } = await admin
    .from('users')
    .select('id, email, name, is_vip, ai_credits, is_admin')
    .eq('id', uid)
    .maybeSingle();

  if (lookupErr) throw new Error(`User lookup failed: ${lookupErr.message}`);
  if (!target) throw new Error('User not found');

  if (target.id === args.admin.id) {
    throw new Error('You cannot delete your own admin account');
  }
  if (target.is_admin) {
    throw new Error('Cannot delete an admin account — revoke is_admin first');
  }

  // referral_uses has no ON DELETE CASCADE on either column, so it must be
  // cleared first or the users delete fails on a FK violation.
  //
  // These are thunks, not promises: building the promises eagerly would fire all
  // ten deletes concurrently, and Postgres would then reject whichever one lost
  // the race against its own foreign keys (transactions.wallet_id → wallets).
  const cleanup: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
    ['referral_uses', () => admin.from('referral_uses').delete().or(`referrer_id.eq.${uid},referred_user_id.eq.${uid}`)],
    ['ai_conclusions', () => admin.from('ai_conclusions').delete().eq('user_id', uid)],
    ['rate_limits', () => admin.from('rate_limits').delete().eq('user_id', uid)],
    ['transactions', () => admin.from('transactions').delete().eq('user_id', uid)],
    ['recurring_rules', () => admin.from('recurring_rules').delete().eq('user_id', uid)],
    ['budgets', () => admin.from('budgets').delete().eq('user_id', uid)],
    ['categories', () => admin.from('categories').delete().eq('user_id', uid)],
    ['wallets', () => admin.from('wallets').delete().eq('user_id', uid)],
    ['subscriptions', () => admin.from('subscriptions').delete().eq('user_id', uid)],
    ['referral_codes', () => admin.from('referral_codes').delete().eq('user_id', uid)],
  ];

  for (const [table, run] of cleanup) {
    const { error } = await run();
    // A missing/renamed table must not abort the delete, but it must be visible.
    if (error) console.error(`[admin] ${table} cleanup failed:`, error.message);
  }

  const { error: profileErr } = await admin.from('users').delete().eq('id', uid);
  if (profileErr) throw new Error(`Profile delete failed: ${profileErr.message}`);

  const { error: authErr } = await admin.auth.admin.deleteUser(uid);
  if (authErr) {
    // The profile row is already gone, so this is a real inconsistency an
    // operator must see rather than a silent success.
    throw new Error(
      `Auth user delete failed after profile removal — the auth.users row for ${uid} ` +
        `may need manual deletion in the Supabase dashboard: ${authErr.message}`
    );
  }

  const { ip, userAgent } = requestMeta(args.request);
  const { error: auditErr } = await admin.rpc('admin_write_audit', {
    p_admin_id: args.admin.id,
    p_action: 'user.delete',
    p_target_id: uid,
    p_target_email: target.email,
    p_changes: { deleted_user: { from: target, to: null } },
    p_reason: args.reason ?? null,
    p_ip: ip,
    p_ua: userAgent,
  });

  if (auditErr) {
    throw new Error(
      `User ${uid} was deleted but the audit entry failed to write: ${auditErr.message}`
    );
  }
}
