import { addDays, addMonths, format, parseISO } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { useI18nStore } from './i18n';
import { RecurringFrequency } from '../types';

/**
 * recurring_rules.day_of_month is constrained to 1..28 in the schema, and the
 * server-side scheduler clamps to the same bound. A rule anchored to the 29th-31st
 * cannot exist in every month, so the clamp is applied here too — otherwise the form
 * would promise a date the database then silently moves.
 */
export const MAX_DAY_OF_MONTH = 28;

const locale = () => (useI18nStore.getState().locale === 'id' ? id : enUS);

export const FREQUENCY_OPTIONS: Array<{ label: string; value: RecurringFrequency }> = [
  { label: 'Harian', value: 'daily' },
  { label: 'Mingguan', value: 'weekly' },
  { label: 'Bulanan', value: 'monthly' },
];

/** Clamps a candidate day into the range the schema accepts. */
export function clampDayOfMonth(day: number): number {
  return Math.min(Math.max(Math.round(day) || 1, 1), MAX_DAY_OF_MONTH);
}

/**
 * The occurrence after `from`. Mirrors public.next_recurring_occurrence() so the
 * preview in the form agrees with what the daily cron will actually post.
 */
export function nextOccurrence(
  from: string,
  frequency: RecurringFrequency,
  dayOfMonth?: number | null
): string {
  const base = parseISO(from);

  if (frequency === 'weekly') return format(addDays(base, 7), 'yyyy-MM-dd');
  if (frequency !== 'monthly') return format(addDays(base, 1), 'yyyy-MM-dd');

  const day = clampDayOfMonth(dayOfMonth ?? base.getDate());
  return format(addMonths(parseISO(format(base, 'yyyy-MM-01')), 1), 'yyyy-MM') +
    `-${String(day).padStart(2, '0')}`;
}

/** Human label for a rule's cadence, e.g. "Setiap tanggal 5" / "Setiap Senin". */
export function describeSchedule(rule: {
  frequency: RecurringFrequency;
  day_of_month: number | null;
  next_due_date: string;
}): string {
  if (rule.frequency === 'weekly') {
    return `Setiap ${format(parseISO(rule.next_due_date), 'EEEE', { locale: locale() })}`;
  }
  if (rule.frequency === 'monthly') {
    const day = rule.day_of_month ?? clampDayOfMonth(parseISO(rule.next_due_date).getDate());
    return `Setiap tanggal ${day}`;
  }
  return 'Setiap hari';
}

/**
 * What the form will store, derived from the start date the user picked.
 * Monthly rules snap to a day the schema can represent in every month.
 */
export function scheduleFromStartDate(
  startDate: string,
  frequency: RecurringFrequency
): { next_due_date: string; day_of_month: number | null } {
  if (frequency !== 'monthly') {
    return { next_due_date: startDate, day_of_month: null };
  }

  const day = clampDayOfMonth(parseISO(startDate).getDate());
  return {
    next_due_date: format(parseISO(startDate), 'yyyy-MM') + `-${String(day).padStart(2, '0')}`,
    day_of_month: day,
  };
}
