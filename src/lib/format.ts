import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { useI18nStore } from './i18n';

export function formatIDR(amount: number): string {
  const isNegative = amount < 0;
  const absoluteVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(absoluteVal);
  
  return `${isNegative ? '-' : ''}Rp ${formatted}`;
}

export function formatCompact(amount: number): string {
  const isNegative = amount < 0;
  const val = Math.abs(amount);
  const locale = useI18nStore.getState().locale;
  const sign = isNegative ? '-' : '';

  if (val >= 1_000_000_000) {
    const formatted = (val / 1_000_000_000).toFixed(1).replace('.', ',');
    return `${sign}${formatted}${locale === 'id' ? 'M' : 'B'}`;
  }
  if (val >= 1_000_000) {
    const formatted = (val / 1_000_000).toFixed(1).replace('.', ',');
    return `${sign}${formatted}${locale === 'id' ? 'jt' : 'M'}`;
  }
  if (val >= 1_000) {
    const formatted = (val / 1_000).toFixed(0);
    return `${sign}${formatted}${locale === 'id' ? 'rb' : 'k'}`;
  }
  return `${sign}${val}`;
}

export function formatDate(dateStr: string): string {
  try {
    const dateObj = parseISO(dateStr);
    const locale = useI18nStore.getState().locale === 'id' ? id : enUS;
    return format(dateObj, 'd MMM yyyy', { locale });
  } catch (e) {
    return dateStr;
  }
}

export function formatDateRelative(dateStr: string): string {
  try {
    const dateObj = parseISO(dateStr);
    const localeState = useI18nStore.getState().locale;
    const locale = localeState === 'id' ? id : enUS;

    if (isToday(dateObj)) {
      return localeState === 'id' ? 'Hari ini' : 'Today';
    }
    if (isYesterday(dateObj)) {
      return localeState === 'id' ? 'Kemarin' : 'Yesterday';
    }
    return format(dateObj, 'd MMM', { locale });
  } catch (e) {
    return dateStr;
  }
}

export function formatMonthDisplay(monthStr: string): string {
  try {
    // monthStr: YYYY-MM
    const dateObj = parseISO(`${monthStr}-01`);
    const locale = useI18nStore.getState().locale === 'id' ? id : enUS;
    return format(dateObj, 'MMMM yyyy', { locale });
  } catch (e) {
    return monthStr;
  }
}

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

export function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
