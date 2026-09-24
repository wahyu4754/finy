import { supabase } from './supabase';
import { ParsedReceipt, AIConclusion, MonthlyStats } from '../types';

export async function scanReceipt(file: File): Promise<ParsedReceipt> {
  try {
    // 1. In real app: upload file to bucket or convert to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip base64 metadata prefix if exists
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });

    const base64Data = await base64Promise;

    // 2. Call Supabase edge function 'parse-receipt'
    const { data, error } = await supabase.functions.invoke('parse-receipt', {
      body: {
        imageBase64: base64Data,
        mimeType: file.type,
        userCategories: ['Makan', 'Jajan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya']
      }
    });

    if (error) throw error;
    if (data) return data as ParsedReceipt;

    throw new Error('Empty response');
  } catch (err) {
    console.error('scanReceipt failed:', err);
    throw err instanceof Error ? err : new Error('Failed to parse receipt');
  }
}

/**
 * Returns the AI conclusion for `month`, sending the real figures for that month.
 *
 * The edge function answers from its `ai_conclusions` cache when it has one, so a
 * repeat visit costs no credit; pass `refresh: true` to force a regeneration.
 * Throws an Error whose message is the server's machine-readable code
 * (INSUFFICIENT_CREDITS, RATE_LIMITED, AI_SERVICE_ERROR, …) so the caller can
 * translate it — never a fabricated conclusion.
 */
export async function generateMonthlyConclusion(
  month: string,
  stats: MonthlyStats,
  options?: { refresh?: boolean }
): Promise<AIConclusion> {
  try {
    const { data, error } = await supabase.functions.invoke('monthly-conclusion', {
      body: { month, stats, refresh: options?.refresh === true },
    });

    // functions-js reports a non-2xx as FunctionsHttpError whose .message is the generic
    // "Edge Function returned a non-2xx status code"; the real body sits on error.context.
    if (error) {
      const body = await (error.context?.json?.() ?? Promise.resolve(null)).catch(() => null);
      throw new Error(String(body?.error ?? error.message ?? 'ANALYSIS_FAILED'));
    }
    if (data?.error) throw new Error(String(data.error));
    if (typeof data?.summary !== 'string') throw new Error('AI_INVALID_RESPONSE');

    return data as AIConclusion;
  } catch (err) {
    console.error('generateMonthlyConclusion failed:', err);
    throw err instanceof Error ? err : new Error('ANALYSIS_FAILED');
  }
}
