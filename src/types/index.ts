export type WalletType = 'cash' | 'bank' | 'ewallet';
export type TransactionType = 'expense' | 'income';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface User {
  id: string;
  email: string;
  name: string;
  is_vip: boolean;
  trial_ends_at: string;
  vip_until: string | null;
  ai_credits: number;
  avatar_url?: string;
  referred_by_code?: string;
  has_vip_voucher: boolean;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  type: WalletType;
  balance: number;
  is_default: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  is_default: boolean;
  is_archived?: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  note: string;
  receipt_image_url?: string;
  transaction_date: string;
  is_recurring: boolean;
  recurring_period?: string;
  created_by_ai: boolean;
  created_at: string;
  category?: Category;
  wallet?: Wallet;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  wallet_id: string | null;
  amount: number;
  month: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category_id: string | null;
  wallet_id: string | null;
  note: string;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  category?: Category;
  wallet?: Wallet;
}

export interface AIInsight {
  title: string;
  description: string;
  type: 'warning' | 'tip' | 'praise';
}

export interface AIConclusion {
  id: string;
  user_id: string;
  month: string;
  summary: string;
  insights: AIInsight[];
  generated_at: string;
}

export interface ParsedReceipt {
  merchant: string;
  total: number;
  date: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  suggested_category?: string;
  confidence?: number;
}
