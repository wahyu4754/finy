# Finy Admin CMS

Internal control panel at **`/admin`** for managing users and their subscriptions.
Not indexed by search engines, not reachable without an admin account.

## Setup (three manual steps)

### 1. Apply migration `020_admin_cms.sql`

Supabase dashboard → SQL Editor → paste the contents of
`supabase/migrations/020_admin_cms.sql` → Run.

It adds `users.is_admin` and `users.is_banned`, creates the append-only
`admin_audit_log` table, adds list/sort indexes, and creates three
service-role-only functions (`admin_manage_user`, `admin_write_audit`,
`admin_dashboard_stats`). Every statement is idempotent, so re-running it is
safe.

### 2. Add the service-role key

```
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>
```

Supabase → Project Settings → API → **service_role (secret)**. Add it to
`.env.local` (restart the dev server afterwards) and to Vercel → Settings →
Environment Variables.

This key bypasses every RLS policy. It must never be prefixed with
`NEXT_PUBLIC_`, and `src/lib/supabase-admin.ts` throws at import time if it is
ever pulled into a browser bundle.

### 3. Promote your account

```sql
update public.users set is_admin = true where email = 'you@example.com';
select id, email, name, is_admin from public.users where is_admin = true;
```

Then sign in and open `/admin`.

## What you can do

| Area | Actions |
|---|---|
| Dashboard | Totals for users, VIP, revenue, new signups (7d/30d), suspended, admins; newest users; recent admin activity |
| Users | Search by name/email, filter (All / VIP / Free / On trial / Lapsed / Suspended / Admins), sort by any column, paginate |
| User detail | Grant VIP (+30/90/365d or an exact expiry), revoke VIP, edit name, set AI credits (+10 shortcut), reset trial to 7 days, edit streak, toggle VIP voucher, suspend/restore, delete permanently |
| Audit log | Every change with who, when, from which IP, and the exact before → after values. Filterable by action, searchable by email |

## Design notes worth knowing

**VIP has two sources of truth.** `usePurchasesStore.checkVipStatus()` treats a
user as VIP if `users.is_vip` is true **or** if an active, unexpired
`subscriptions` row exists. Revoking only the flag therefore silently fails.
`admin_manage_user()` handles both in one transaction — a revoke sets
`is_vip = false`, clears `vip_until`, and cancels every pending/active
subscription row.

**`vip_until = NULL` with `is_vip = true` is permanent.** The `expire-vip-hourly`
cron job from migration 018 only touches rows where `vip_until IS NOT NULL`.
The detail page labels this state "VIP · no expiry" so it is not mistaken for a
bug.

**`is_vip` can lag expiry by up to an hour.** The cron runs hourly, so a lapsed
user keeps `is_vip = true` until it fires — and still genuinely has VIP, because
`checkVipStatus()` short-circuits on the flag before checking the date. The badge
reads "VIP · expiry pending" for that window rather than claiming either
extreme.

**Dashboard totals come from `admin_dashboard_stats()`, not client queries.**
`config.toml` sets `[api] max_rows = 1000`, so summing revenue by selecting the
`amount` column would silently cap at 1000 payments and under-report. The RPC
aggregates in-database and returns every figure in one round trip.

**Everything is atomic and audited.** PostgREST cannot span multiple calls in one
transaction, so the users update, the subscriptions update and the audit insert
all happen inside `admin_manage_user()`. There is no path that changes data
without writing an audit row.

**Privilege escalation is blocked by the grants from migration 009**
(`revoke update on users from authenticated` + `grant update (name, avatar_url)`).
Column grants are an exhaustive allowlist, so a signed-in user cannot set
`is_admin` on their own row.

**Suspension is enforced in `src/middleware.ts`**, not in the client stores.
A banned user's session cookie is cleared and they are redirected to
`/sign-in?suspended=1`; API routes get a `403` JSON body. Clearing the cookie
matters — leaving it in place would ping-pong the browser between `/home` and
`/sign-in`.

**Account deletion** mirrors `supabase/functions/delete-account` and adds the
tables it omits (`ai_conclusions`, `rate_limits`, `referral_codes`). It refuses
to delete an admin account or your own. `referral_claims_log` is deliberately
left intact: it is keyed on email and must outlive the account, or the referral
abuse guard from migration 013 stops working.

**The audit log is append-only.** No UPDATE or DELETE policy exists, and the CMS
exposes no endpoint that would modify it.

## Files

```
supabase/migrations/020_admin_cms.sql        schema, RPCs, indexes
src/lib/supabase-admin.ts                    service-role client (server-only)
src/lib/admin-auth.ts                        getAdminUser / requireAdmin gate
src/lib/admin-users.ts                       queries + mutations
src/lib/admin-audit.ts                       audit reads, search sanitising
src/app/api/admin/users/[id]/route.ts        PATCH + DELETE (mutations only)
src/app/(admin)/admin/**                     layout, dashboard, users, audit
src/components/admin/**                      shell, toolbar, table, action panel
```

Pages are Server Components that call `src/lib/admin-users.ts` directly, so
filtering and pagination are URL-driven with no client fetch. The API surface is
mutations only — read endpoints would have no caller.
