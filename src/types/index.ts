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
  id: string | null;
  user_id?: string;
  month: string;
  summary: string;
  insights: AIInsight[];
  generated_at: string;
  /** true when the answer came from the ai_conclusions cache instead of a new Gemini call */
  cached?: boolean;
}

/** Payload the `monthly-conclusion` edge function analyses. Field names are the contract. */
export interface MonthlyStats {
  totalBalance: number;
  totalExpense: number;
  totalIncome: number;
  budget: number;
  lastMonthExpense: number;
  transactionCount: number;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  topTransactions: Array<{ note: string; category: string; amount: number; date: string }>;
}

export interface ParsedReceipt {
  merchant: string;
  total: number;
  date: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  suggested_category?: string;
  confidence?: number;
}

export interface SnapResult {
  status_code?: string;
  status_message?: string[];
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  payment_type?: string;
  transaction_time?: string;
  transaction_status?: string;
  fraud_status?: string;
  pdf_url?: string;
  finish_redirect_url?: string;
}

export interface SnapCallbacks {
  onSuccess?: (result: SnapResult) => void;
  onPending?: (result: SnapResult) => void;
  onError?: (result: SnapResult) => void;
  onClose?: () => void;
}

export interface SnapPayOptions extends SnapCallbacks {
  uiMode?: 'deeplink' | 'qr';
  skipOrderSummary?: boolean;
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: SnapPayOptions) => void;
      embed: (token: string, options: { embedId: string } & SnapPayOptions) => void;
      hide: () => void;
    };
  }
}

