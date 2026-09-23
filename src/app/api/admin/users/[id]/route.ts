import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, adminErrorResponse } from '../../../../../lib/admin-auth';
import { getUserDetail, manageUser, deleteUser } from '../../../../../lib/admin-users';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isoDate = () =>
  z.string().refine(v => !Number.isNaN(Date.parse(v)), { message: 'Invalid ISO date' });

const patchSchema = z
  .object({
    updates: z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        ai_credits: z.number().int().min(0).max(1_000_000).optional(),
        trial_ends_at: isoDate().nullable().optional(),
        has_vip_voucher: z.boolean().optional(),
        referral_credits_earned: z.number().int().min(0).max(1_000_000).optional(),
        current_streak: z.number().int().min(0).max(100_000).optional(),
        is_banned: z.boolean().optional(),
      })
      .optional(),
    vip: z
      .discriminatedUnion('mode', [
        z.object({ mode: z.literal('grant'), days: z.number().int().min(1).max(3650) }),
        z.object({ mode: z.literal('set_until'), until: isoDate() }),
        z.object({ mode: z.literal('revoke') }),
      ])
      .nullable()
      .optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    body =>
      (body.updates && Object.keys(body.updates).length > 0) ||
      body.vip !== undefined && body.vip !== null,
    { message: 'Nothing to update: send `updates` and/or `vip`.' }
  );

const deleteSchema = z.object({
  confirmEmail: z.string().trim().min(1),
  reason: z.string().trim().max(500).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin();

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const user = await getUserDetail(id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ user });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const admin = await requireAdmin();

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 }
      );
    }

    const { updates, vip, reason } = parsed.data;

    // Refuse the one change that would lock the operator out of the CMS.
    // Revoking your own VIP is allowed: is_admin is independent of is_vip.
    if (id === admin.id && updates?.is_banned) {
      return NextResponse.json(
        { error: 'You cannot suspend your own account' },
        { status: 400 }
      );
    }

    const action = vip
      ? `user.vip.${vip.mode}`
      : updates && 'is_banned' in updates
        ? updates.is_banned
          ? 'user.ban'
          : 'user.unban'
        : 'user.update';

    const result = await manageUser({
      admin,
      targetId: id,
      updates,
      vip,
      action,
      reason,
      request,
    });

    return NextResponse.json({ ok: true, changes: result.changes, after: result.after });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const admin = await requireAdmin();

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'confirmEmail and a valid body are required' },
        { status: 400 }
      );
    }

    const target = await getUserDetail(id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Irreversible, so the operator must retype the address. Compared
    // case-insensitively because Supabase stores auth emails lowercased while
    // public.users keeps whatever the signup trigger wrote.
    if (target.email.toLowerCase() !== parsed.data.confirmEmail.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'Confirmation email does not match this account' },
        { status: 400 }
      );
    }

    await deleteUser({
      admin,
      targetId: id,
      reason: parsed.data.reason,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Cannot delete')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message.includes('cannot delete your own')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return adminErrorResponse(err);
  }
}
