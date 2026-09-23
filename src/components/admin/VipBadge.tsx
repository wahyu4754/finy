import Badge from '../ui/Badge';

/**
 * Single place that interprets the VIP fields.
 *
 * `users.is_vip` is the primary flag, but it is not self-sufficient: the
 * pg_cron job from migration 018 clears it once `vip_until` passes, and
 * `usePurchasesStore.checkVipStatus()` can also derive VIP from an active
 * `subscriptions` row. The detail page therefore shows the subscription rows
 * alongside this badge rather than letting the badge be the whole story.
 */
export type VipState =
  | 'vip'
  | 'expiry_pending'
  | 'indefinite'
  | 'expired'
  | 'trial'
  | 'free'
  | 'banned';

interface VipFields {
  is_vip: boolean;
  vip_until: string | null;
  trial_ends_at?: string | null;
  is_banned?: boolean;
}

export function vipState(user: VipFields): VipState {
  if (user.is_banned) return 'banned';

  const now = Date.now();
  const until = user.vip_until ? new Date(user.vip_until).getTime() : null;

  if (user.is_vip) {
    // is_vip with no expiry never gets collected by the cron job, which only
    // touches rows where vip_until IS NOT NULL — so it is effectively permanent.
    if (until === null) return 'indefinite';
    // Past expiry but the flag is still set: the expire-vip-hourly cron from
    // migration 018 has not run yet. The user genuinely still has VIP, because
    // checkVipStatus() short-circuits on is_vip before looking at the date, so
    // this is "still active, about to be revoked" rather than "expired".
    if (until < now) return 'expiry_pending';
    return 'vip';
  }

  if (until !== null && until < now) return 'expired';

  const trial = user.trial_ends_at ? new Date(user.trial_ends_at).getTime() : null;
  if (trial !== null && trial > now) return 'trial';

  return 'free';
}

const LABELS: Record<VipState, string> = {
  vip: 'VIP',
  expiry_pending: 'VIP · expiry pending',
  indefinite: 'VIP · no expiry',
  expired: 'Expired',
  trial: 'Trial',
  free: 'Free',
  banned: 'Suspended',
};

const VARIANTS: Record<VipState, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  vip: 'success',
  expiry_pending: 'warning',
  indefinite: 'warning',
  expired: 'default',
  trial: 'info',
  free: 'default',
  banned: 'danger',
};

export function vipLabel(state: VipState): string {
  return LABELS[state];
}

export default function VipBadge({ user }: { user: VipFields }) {
  const state = vipState(user);
  return <Badge variant={VARIANTS[state]}>{LABELS[state]}</Badge>;
}
