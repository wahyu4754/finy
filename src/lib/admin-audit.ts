import { getAdminClient } from './supabase-admin';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/** Best-effort client identity for the audit trail. Never trusted for auth. */
export function requestMeta(request?: Request): RequestMeta {
  if (!request) return { ip: null, userAgent: null };

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip');

  return {
    ip: ip || null,
    userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
  };
}

export interface AuditEntry {
  id: number;
  admin_id: string | null;
  admin_email: string | null;
  target_user_id: string | null;
  target_user_email: string | null;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const AUDIT_COLUMNS = `
  id, admin_id, admin_email, target_user_id, target_user_email,
  action, changes, reason, ip_address, user_agent, created_at
`;

export interface ListAuditParams {
  page?: number;
  pageSize?: number;
  action?: string;
  adminId?: string;
  targetUserId?: string;
  search?: string;
}

export async function listAuditLog(
  params: ListAuditParams = {}
): Promise<{ rows: AuditEntry[]; count: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  let query = getAdminClient()
    .from('admin_audit_log')
    .select(AUDIT_COLUMNS, { count: 'exact' });

  if (params.action) query = query.eq('action', params.action);
  if (params.adminId) query = query.eq('admin_id', params.adminId);
  if (params.targetUserId) query = query.eq('target_user_id', params.targetUserId);

  // Match on either email column so an admin can search by who acted or by
  // who was acted upon.
  const search = sanitizeSearchTerm(params.search);
  if (search) {
    query = query.or(`admin_email.ilike.%${search}%,target_user_email.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw new Error(`Audit log query failed: ${error.message}`);

  return { rows: (data ?? []) as AuditEntry[], count: count ?? 0 };
}

/**
 * PostgREST parses `,` `(` `)` as filter syntax inside .or(), so an unescaped
 * search term could restructure the query — strip those and the backslash.
 * `%` goes too (unbounded wildcard). `_` is kept deliberately: it is also an
 * ILIKE single-char wildcard, but removing it would break searching real
 * addresses like john_doe@mail.com, and the worst case is a slightly broader
 * match, not a different query.
 */
export function sanitizeSearchTerm(term?: string | null): string {
  if (!term) return '';
  return term.replace(/[,()%\\]/g, '').trim().slice(0, 120);
}
