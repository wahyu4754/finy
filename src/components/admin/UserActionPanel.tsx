'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Ban,
  CircleCheck,
  Trash2,
  Save,
  Zap,
  Gift,
  CalendarClock,
  ShieldAlert,
} from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { useToastStore } from '../../store/toast';
import VipBadge from './VipBadge';
import type { AdminUserRow } from '../../lib/admin-users';
import styles from './Admin.module.css';

/** ISO string -> value for <input type="datetime-local"> in the browser's zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function plusDaysIso(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString();
}

interface PatchBody {
  updates?: Record<string, unknown>;
  vip?: { mode: 'grant'; days: number } | { mode: 'set_until'; until: string } | { mode: 'revoke' } | null;
  reason?: string | null;
}

export default function UserActionPanel({
  user,
  isSelf,
}: {
  user: AdminUserRow;
  isSelf: boolean;
}) {
  const router = useRouter();
  const showToast = useToastStore(s => s.showToast);

  const [name, setName] = useState(user.name);
  const [credits, setCredits] = useState(user.ai_credits);
  const [streak, setStreak] = useState(user.current_streak);
  const [voucher, setVoucher] = useState(user.has_vip_voucher);
  const [vipInput, setVipInput] = useState(toLocalInput(user.vip_until));
  const [trialInput, setTrialInput] = useState(toLocalInput(user.trial_ends_at));
  const [reason, setReason] = useState('');

  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');

  const originalVipIso = user.vip_until ? new Date(user.vip_until).toISOString() : null;
  const originalTrialIso = user.trial_ends_at ? new Date(user.trial_ends_at).toISOString() : null;

  // router.refresh() re-renders the server tree but React preserves this
  // component's state, so after a quick action (e.g. "+365d VIP") the badges
  // would show the new value while the inputs still showed the old one. Resync
  // from props whenever the persisted values change. `reason` is deliberately
  // left alone — it belongs to the operator, not to the row.
  useEffect(() => {
    setName(user.name);
    setCredits(user.ai_credits);
    setStreak(user.current_streak);
    setVoucher(user.has_vip_voucher);
    setVipInput(toLocalInput(user.vip_until));
    setTrialInput(toLocalInput(user.trial_ends_at));
  }, [
    user.name,
    user.ai_credits,
    user.current_streak,
    user.has_vip_voucher,
    user.vip_until,
    user.trial_ends_at,
  ]);

  async function patch(body: PatchBody, label: string) {
    setBusy(label);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, reason: reason.trim() || null }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);

      const changed = body.updates ? Object.keys(body.updates).length : 0;
      showToast(
        body.vip ? `${label} applied` : changed > 0 ? `${label} saved` : 'No changes to save',
        changed > 0 || body.vip ? 'success' : 'info'
      );

      if (changed > 0 || body.vip) router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong', 'error');
    } finally {
      setBusy(null);
    }
  }

  function buildDiff(): Record<string, unknown> {
    const updates: Record<string, unknown> = {};

    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== user.name) updates.name = trimmedName;
    if (credits !== user.ai_credits) updates.ai_credits = Math.max(0, credits);
    if (streak !== user.current_streak) updates.current_streak = Math.max(0, streak);
    if (voucher !== user.has_vip_voucher) updates.has_vip_voucher = voucher;

    const trialIso = fromLocalInput(trialInput);
    if (trialIso !== originalTrialIso) updates.trial_ends_at = trialIso;

    return updates;
  }

  async function saveChanges() {
    const updates = buildDiff();
    const vipIso = fromLocalInput(vipInput);
    const vipChanged = vipIso !== originalVipIso;

    if (Object.keys(updates).length === 0 && !vipChanged) {
      showToast('No changes to save', 'info');
      return;
    }

    await patch(
      {
        updates: Object.keys(updates).length > 0 ? updates : undefined,
        // Clearing the expiry date is treated as a revocation: it also cancels
        // any pending/active subscription rows server-side, so the app cannot
        // re-derive VIP from them.
        vip: vipChanged
          ? vipIso
            ? { mode: 'set_until', until: vipIso }
            : { mode: 'revoke' }
          : undefined,
      },
      'Changes'
    );
  }

  async function removeAccount() {
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim(), reason: reason.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);

      showToast('Account deleted permanently', 'success');
      setDeleteOpen(false);
      router.replace('/admin/users');
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  const isBanned = user.is_banned;

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.panelTitle}>Manage user</h2>
            <p className={styles.panelSub}>
              Every change below is written to the audit log with its before and after value.
            </p>
          </div>
          <VipBadge user={user} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="reason">
            Reason (stored in the audit log)
          </label>
          <input
            id="reason"
            className={styles.textInput}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. support ticket #482 — refunded manually"
            maxLength={500}
          />
        </div>

        {/* ---------------------------------------------------- Subscription */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>
            <Crown size={14} /> Subscription
          </div>

          <div className={styles.quickRow}>
            {[30, 90, 365].map(days => (
              <button
                key={days}
                type="button"
                className={styles.quickBtn}
                disabled={busy !== null}
                onClick={() => patch({ vip: { mode: 'grant', days } }, `Grant ${days}d VIP`)}
              >
                <Zap size={13} /> +{days}d VIP
              </button>
            ))}

            <button
              type="button"
              className={`${styles.quickBtn} ${styles.quickBtnDanger}`}
              disabled={busy !== null || !user.is_vip}
              onClick={() => patch({ vip: { mode: 'revoke' } }, 'Revoke VIP')}
            >
              <Ban size={13} /> Revoke VIP
            </button>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="vipUntil">
              VIP expires at <span className={styles.labelHint}>(clear to revoke)</span>
            </label>
            <input
              id="vipUntil"
              type="datetime-local"
              className={styles.textInput}
              value={vipInput}
              onChange={e => setVipInput(e.target.value)}
            />
          </div>

          {user.vip_until && new Date(user.vip_until).getTime() < Date.now() && (
            <div className={styles.inlineWarn}>
              <ShieldAlert size={14} />
              Expiry is in the past. The hourly <code>expire-vip-hourly</code> cron job will clear
              <code> is_vip</code> automatically.
            </div>
          )}
        </div>

        {/* --------------------------------------------------------- Profile */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>Profile &amp; balance</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">
                Display name
              </label>
              <input
                id="name"
                className={styles.textInput}
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="credits">
                AI credits
              </label>
              <div className={styles.stepperRow}>
                <input
                  id="credits"
                  type="number"
                  min={0}
                  max={1000000}
                  className={styles.textInput}
                  value={credits}
                  onChange={e => setCredits(Number(e.target.value) || 0)}
                />
                <button
                  type="button"
                  className={styles.stepperBtn}
                  disabled={busy !== null}
                  onClick={() => patch({ updates: { ai_credits: user.ai_credits + 10 } }, '+10 credits')}
                  title="Grant 10 credits immediately"
                >
                  +10
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="streak">
                Current streak
              </label>
              <input
                id="streak"
                type="number"
                min={0}
                max={100000}
                className={styles.textInput}
                value={streak}
                onChange={e => setStreak(Number(e.target.value) || 0)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="trial">
                Trial ends at
              </label>
              <div className={styles.stepperRow}>
                <input
                  id="trial"
                  type="datetime-local"
                  className={styles.textInput}
                  value={trialInput}
                  onChange={e => setTrialInput(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.stepperBtn}
                  disabled={busy !== null}
                  onClick={() => patch({ updates: { trial_ends_at: plusDaysIso(7) } }, 'Trial reset')}
                  title="Reset the trial to 7 days from now"
                >
                  <CalendarClock size={13} /> 7d
                </button>
              </div>
            </div>
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={voucher}
              onChange={e => setVoucher(e.target.checked)}
            />
            <Gift size={14} />
            <span>
              Has unused VIP voucher
              {user.has_vip_voucher && (
                <Badge variant="warning" className={styles.inlineBadge}>
                  granted
                </Badge>
              )}
            </span>
          </label>

          <Button
            onClick={saveChanges}
            loading={busy === 'Changes'}
            disabled={busy !== null}
            icon={<Save size={16} />}
          >
            Save changes
          </Button>
        </div>

        {/* ------------------------------------------------------ Moderation */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>
            <ShieldAlert size={14} /> Moderation
          </div>

          <div className={styles.actionRow}>
            <Button
              variant={isBanned ? 'secondary' : 'danger'}
              size="sm"
              disabled={busy !== null || isSelf}
              loading={busy === (isBanned ? 'Restore' : 'Suspend')}
              icon={isBanned ? <CircleCheck size={16} /> : <Ban size={16} />}
              onClick={() =>
                patch({ updates: { is_banned: !isBanned } }, isBanned ? 'Restore' : 'Suspend')
              }
            >
              {isBanned ? 'Restore access' : 'Suspend account'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null || isSelf}
              icon={<Trash2 size={16} />}
              onClick={() => {
                setConfirmEmail('');
                setDeleteOpen(true);
              }}
            >
              Delete permanently
            </Button>
          </div>

          {isSelf && (
            <p className={styles.inlineHint}>
              You cannot suspend or delete your own account — use a second admin.
            </p>
          )}

          <p className={styles.inlineHint}>
            Suspending takes effect on the user&rsquo;s next request: middleware clears their
            session and redirects to sign-in. Deleting is irreversible and also removes the
            auth account, wallets, transactions, budgets and subscriptions.
          </p>
        </div>
      </div>

      <Modal
        isOpen={deleteOpen}
        onClose={() => busy !== 'delete' && setDeleteOpen(false)}
        title="Delete account permanently"
      >
        <div className={styles.deleteBody}>
          <p className={styles.deleteWarn}>
            This erases <strong>{user.name}</strong> ({user.email}) and all of their financial
            data. It cannot be undone, and it does not release their email from the referral
            abuse guard.
          </p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmEmail">
              Type the account email to confirm
            </label>
            <input
              id="confirmEmail"
              className={styles.textInput}
              value={confirmEmail}
              onChange={e => setConfirmEmail(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
            />
          </div>

          <div className={styles.actionRow} style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={busy === 'delete'}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy === 'delete'}
              disabled={confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
              onClick={removeAccount}
              icon={<Trash2 size={16} />}
            >
              Delete account
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
