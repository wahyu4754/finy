import { create } from 'zustand';

export type Locale = 'id' | 'en';

interface TranslationDict {
  [key: string]: {
    id: string;
    en: string;
  };
}

export const translations: TranslationDict = {
  // Common
  appName: { id: 'Finy', en: 'Finy' },
  appTagline: { id: 'Catatan Keuangan Pintar', en: 'Smart Finance Tracker' },
  back: { id: 'Kembali', en: 'Back' },
  save: { id: 'Simpan', en: 'Save' },
  cancel: { id: 'Batal', en: 'Cancel' },
  delete: { id: 'Hapus', en: 'Delete' },
  loading: { id: 'Memuat...', en: 'Loading...' },
  success: { id: 'Berhasil', en: 'Success' },
  error: { id: 'Kesalahan', en: 'Error' },
  edit: { id: 'Ubah', en: 'Edit' },
  add: { id: 'Tambah', en: 'Add' },
  active: { id: 'Aktif', en: 'Active' },
  inactive: { id: 'Nonaktif', en: 'Inactive' },
  default: { id: 'Bawaan', en: 'Default' },
  all: { id: 'Semua', en: 'All' },
  note: { id: 'Catatan', en: 'Note' },
  amount: { id: 'Jumlah', en: 'Amount' },
  date: { id: 'Tanggal', en: 'Date' },
  wallet: { id: 'Dompet', en: 'Wallet' },
  category: { id: 'Kategori', en: 'Category' },
  type: { id: 'Tipe', en: 'Type' },
  expense: { id: 'Pengeluaran', en: 'Expense' },
  income: { id: 'Pemasukan', en: 'Income' },
  today: { id: 'Hari ini', en: 'Today' },
  yesterday: { id: 'Kemarin', en: 'Yesterday' },
  vipBadge: { id: 'Finy Pro', en: 'Finy Pro' },
  freeBadge: { id: 'Gratis', en: 'Free' },

  // Navigation Tabs
  tabHome: { id: 'Beranda', en: 'Home' },
  tabStats: { id: 'Statistik', en: 'Stats' },
  tabCategories: { id: 'Tools', en: 'Tools' },
  tabProfile: { id: 'Profil', en: 'Profile' },

  // Auth Screen
  signInTitle: { id: 'Masuk ke Finy', en: 'Sign in to Finy' },
  signInSubtitle: { id: 'Bikin arus kas jadi jelas.', en: 'Make your cash flow clear.' },
  signUpTitle: { id: 'Daftar Akun Baru', en: 'Create New Account' },
  signUpSubtitle: { id: 'Mulai kelola keuanganmu lebih baik.', en: 'Start managing your finances better.' },
  emailLabel: { id: 'Alamat Email', en: 'Email Address' },
  passwordLabel: { id: 'Kata Sandi', en: 'Password' },
  nameLabel: { id: 'Nama Lengkap', en: 'Full Name' },
  signInBtn: { id: 'Masuk', en: 'Sign In' },
  signUpBtn: { id: 'Daftar', en: 'Sign Up' },
  oauthGoogle: { id: 'Masuk dengan Google', en: 'Sign In with Google' },
  oauthDivider: { id: 'atau masuk dengan email', en: 'or sign in with email' },
  noAccount: { id: 'Belum punya akun? Daftar', en: 'Don\'t have an account? Sign Up' },
  haveAccount: { id: 'Sudah punya akun? Masuk', en: 'Already have an account? Sign In' },

  // Home Screen
  hello: { id: 'Halo', en: 'Hello' },
  totalBalance: { id: 'Total Saldo', en: 'Total Balance' },
  recentTransactions: { id: 'Transaksi Terakhir', en: 'Recent Transactions' },
  viewAll: { id: 'Lihat Semua', en: 'View All' },
  budgetProgress: { id: 'Progres Anggaran', en: 'Budget Progress' },
  topExpenses: { id: 'Top Pengeluaran', en: 'Top Expenses' },
  quickActions: { id: 'Aksi Cepat', en: 'Quick Actions' },
  scanReceipt: { id: 'Scan Struk', en: 'Scan Receipt' },
  aiAssistant: { id: 'Asisten AI', en: 'AI Assistant' },
  streakDays: { id: 'hari beruntun', en: 'day streak' },

  // Stats Screen
  statsPeriodWeek: { id: 'Minggu', en: 'Week' },
  statsPeriodMonth: { id: 'Bulan', en: 'Month' },
  statsPeriod3Months: { id: '3 Bulan', en: '3 Months' },
  statsTitle: { id: 'Analisis Keuangan', en: 'Financial Analysis' },
  statsEmpty: { id: 'Tidak ada data untuk periode ini.', en: 'No data for this period.' },
  largestTransactions: { id: 'Transaksi Terbesar', en: 'Largest Transactions' },

  // Wallet Screen
  walletManageTitle: { id: 'Kelola Dompet', en: 'Manage Wallets' },
  walletAddTitle: { id: 'Tambah Dompet', en: 'Add Wallet' },
  walletEditTitle: { id: 'Ubah Dompet', en: 'Edit Wallet' },
  walletTypeCash: { id: 'Tunai', en: 'Cash' },
  walletTypeBank: { id: 'Rekening Bank', en: 'Bank Account' },
  walletTypeEWallet: { id: 'Dompet Digital', en: 'E-Wallet' },
  walletTypeEwallet: { id: 'Dompet Digital', en: 'E-Wallet' },
  walletInitialBalance: { id: 'Saldo Awal', en: 'Initial Balance' },
  walletSetDefault: { id: 'Jadikan Dompet Utama', en: 'Set as Default Wallet' },
  walletDeleteConfirm: { id: 'Apakah Anda yakin ingin menghapus dompet ini? Semua transaksi terkait juga akan dihapus.', en: 'Are you sure you want to delete this wallet? All related transactions will also be deleted.' },

  // Categories Screen
  categoriesTitle: { id: 'Kelola Kategori', en: 'Manage Categories' },
  categoryAddTitle: { id: 'Tambah Kategori', en: 'Add Category' },
  categoryEditTitle: { id: 'Ubah Kategori', en: 'Edit Category' },
  categoryNamePlaceholder: { id: 'Nama Kategori', en: 'Category Name' },
  categoryColor: { id: 'Warna Kategori', en: 'Category Color' },
  categoryIcon: { id: 'Ikon Kategori', en: 'Category Icon' },
  customCategoryRequiredVIP: { id: 'Membuat kategori kustom membutuhkan Finy Pro.', en: 'Creating custom categories requires Finy Pro.' },

  // Budget Screen
  budgetTitle: { id: 'Anggaran Bulanan', en: 'Monthly Budget' },
  budgetTotal: { id: 'Total Anggaran', en: 'Total Budget' },
  budgetWallet: { id: 'Anggaran Dompet', en: 'Wallet Budget' },
  budgetCategory: { id: 'Anggaran Kategori', en: 'Category Budget' },
  budgetRemaining: { id: 'Sisa Anggaran', en: 'Remaining Budget' },
  budgetOverspent: { id: 'Melebihi Anggaran', en: 'Over Budget' },
  budgetSetTitle: { id: 'Atur Anggaran', en: 'Set Budget' },

  // AI Assistant Chat
  aiChatPlaceholder: { id: 'Tanya asisten keuangan Anda...', en: 'Ask your financial assistant...' },
  aiChatWelcome: { id: 'Halo! Saya asisten Finy. Tanya saya tentang pengeluaran, anggaran, atau minta saran keuangan.', en: 'Hello! I am your Finy assistant. Ask me about spending, budgets, or financial advice.' },
  aiCreditsLeft: { id: 'Kredit AI Tersisa', en: 'AI Credits Left' },
  aiAssistantLocked: { id: 'Asisten AI membutuhkan Finy Pro atau Kredit AI.', en: 'AI Assistant requires Finy Pro or AI Credits.' },
  aiAssistantFreeLimit: { id: 'Batas harian gratis tercapai. Upgrade ke Finy Pro untuk obrolan tanpa batas.', en: 'Daily free limit reached. Upgrade to Finy Pro for unlimited chat.' },

  // Export Screen
  exportTitle: { id: 'Ekspor Data', en: 'Export Data' },
  exportFormat: { id: 'Format File', en: 'File Format' },
  exportSelectFormat: { id: 'Pilih format ekspor data:', en: 'Select export data format:' },
  exportBtn: { id: 'Unduh File', en: 'Download File' },
  exportSuccess: { id: 'Data berhasil diekspor.', en: 'Data successfully exported.' },

  // Referral Screen
  referralTitle: { id: 'Undang Teman', en: 'Invite Friends' },
  referralCode: { id: 'Kode Referral Anda', en: 'Your Referral Code' },
  referralStats: { id: 'Statistik Referral', en: 'Referral Stats' },
  referralInputPlaceholder: { id: 'Masukkan Kode Teman', en: 'Enter Friend\'s Code' },
  referralApplyBtn: { id: 'Gunakan Kode', en: 'Apply Code' },
  referralRewardNotice: { id: 'Undang 3 teman untuk mendapatkan 1 bulan Finy Pro gratis!', en: 'Invite 3 friends to get 1 month of Finy Pro free!' },

  // Security Screen
  securityTitle: { id: 'Keamanan Aplikasi', en: 'App Security' },
  securityLockEnable: { id: 'Aktifkan Kunci PIN', en: 'Enable PIN Lock' },
  securityChangePIN: { id: 'Ubah PIN', en: 'Change PIN' },
  securityEnterPIN: { id: 'Masukkan PIN', en: 'Enter PIN' },
  securityConfirmPIN: { id: 'Konfirmasi PIN', en: 'Confirm PIN' },
  securityPINMismatch: { id: 'PIN tidak cocok.', en: 'PINs do not match.' },
  securityPINWrong: { id: 'PIN salah.', en: 'Wrong PIN.' },

  // Settings & Profile
  profileEditTitle: { id: 'Ubah Profil', en: 'Edit Profile' },
  settingsTitle: { id: 'Pengaturan', en: 'Settings' },
  languageSetting: { id: 'Bahasa', en: 'Language' },
  themeSetting: { id: 'Tema', en: 'Theme' },
  logoutBtn: { id: 'Keluar Akun', en: 'Logout' },
  deleteAccountBtn: { id: 'Hapus Akun Permanen', en: 'Permanently Delete Account' },
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: 'id', // Default to Indonesian, matching original app localization
  setLocale: (locale) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finy_locale', locale);
    }
    set({ locale });
  },
}));

export const initI18n = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('finy_locale') as Locale;
    if (saved === 'id' || saved === 'en') {
      useI18nStore.getState().setLocale(saved);
    }
  }
};

export const t = (key: keyof typeof translations, locale?: Locale): string => {
  const activeLocale = locale || useI18nStore.getState().locale;
  const translation = translations[key];
  if (!translation) return String(key);
  return translation[activeLocale] || translation['en'] || String(key);
};

export const useTranslation = () => {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);
  
  return {
    locale,
    setLocale,
    t: (key: keyof typeof translations) => t(key, locale),
  };
};
