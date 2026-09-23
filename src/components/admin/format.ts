import { format, formatDistanceToNowStrict } from 'date-fns';

/**
 * Admin-only formatting. Deliberately does not reuse src/lib/format.ts: those
 * helpers read the i18n zustand store, which is initialised from localStorage
 * and is not safe to touch during server rendering. The CMS is single-operator
 * and English-only, so fixed patterns are simpler and cannot break RSC.
 */

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'd MMM yyyy, HH:mm');
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'd MMM yyyy');
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDistanceToNowStrict(d)} ago`;
}

/** Whole rupiah, matching the consumer app's display. */
export function fmtIDR(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(value))}`;
}

export function fmtNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0));
}

export function initials(name: string | null | undefined, email: string): string {
  const source = (name || email || '?').trim();
  return source.charAt(0).toUpperCase();
}

/** Render a JSONB change value as something readable in the audit log. */
export function fmtChangeValue(value: unknown): string {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  const asDate = new Date(String(value));
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(asDate.getTime())) {
    return fmtDateTime(value);
  }
  return String(value);
}
