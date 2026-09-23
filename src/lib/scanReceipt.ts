import { supabase } from './supabase';
import { ParsedReceipt, AIConclusion } from '../types';

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

export async function generateMonthlyConclusion(month: string, stats: any): Promise<AIConclusion> {
  try {
    const { data, error } = await supabase.functions.invoke('monthly-conclusion', {
      body: { month, stats }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data) return data as AIConclusion;

    throw new Error('Empty response');
  } catch (err) {
    console.error('generateMonthlyConclusion failed:', err);
    throw err instanceof Error ? err : new Error('Failed to generate monthly conclusion');
  }
}
