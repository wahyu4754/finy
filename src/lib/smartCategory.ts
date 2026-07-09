import { Category, TransactionType } from '../types';

interface KeywordRule {
  categoryName: string;
  keywords: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    categoryName: 'Makan',
    keywords: [
      'warung', 'padang', 'kopi', 'cafe', 'makan', 'lunch', 'dinner', 'breakfast',
      'restoran', 'resto', 'kuliner', 'bakso', 'mie', 'soto', 'nasi', 'gojek', 'gofood',
      'grabfood', 'shopeefood', 'kfc', 'mcd', 'starbucks', 'sushi', 'pizza'
    ],
  },
  {
    categoryName: 'Jajan',
    keywords: [
      'jajan', 'snack', 'cemilan', 'boba', 'eskrim', 'roti', 'martabak', 'indomaret', 'alfamart',
      'minimarket', 'sevel', 'tokopedia', 'permen', 'coklat', 'minuman'
    ],
  },
  {
    categoryName: 'Transport',
    keywords: [
      'bensin', 'pertamax', 'pertalite', 'shell', 'gojek', 'goride', 'gocar', 'grab', 'grabcar',
      'grabride', 'maxim', 'krl', 'commuter', 'mrt', 'lrt', 'busway', 'transjakarta', 'tol',
      'parkir', 'ojek', 'taxi', 'taksi', 'tiket', 'travel'
    ],
  },
  {
    categoryName: 'Belanja',
    keywords: [
      'belanja', 'shopee', 'tokopedia', 'lazada', 'blibli', 'baju', 'kaos', 'celana',
      'sepatu', 'tas', 'jaket', 'aksesoris', 'makeup', 'skincare', 'supermarket', 'hypermart',
      'carrefour', 'transmart', 'mall', 'outlet'
    ],
  },
  {
    categoryName: 'Hiburan',
    keywords: [
      'nonton', 'bioskop', 'netflix', 'spotify', 'youtube', 'games', 'steam', 'topup',
      'liburan', 'hotel', 'rekreasi', 'karaoke', 'konser', 'wisata'
    ],
  },
  {
    categoryName: 'Tagihan',
    keywords: [
      'listrik', 'pln', 'air', 'pdam', 'internet', 'indihome', 'biznet', 'wifi', 'pulsa',
      'kuota', 'bpjs', 'asuransi', 'samsat', 'pajak', 'kos', 'kontrakan', 'cicilan', 'kredit'
    ],
  },
  {
    categoryName: 'Kesehatan',
    keywords: [
      'dokter', 'klinik', 'rumahsakit', 'apotek', 'obat', 'vitamin', 'masker', 'bpjs',
      'doktergigi', 'lab', 'checkup'
    ],
  },
  {
    categoryName: 'Gaji',
    keywords: [
      'gaji', 'salary', 'payroll', 'upah', 'transferan'
    ],
  },
  {
    categoryName: 'Bonus',
    keywords: [
      'bonus', 'thr', 'insentif', 'hadiah', 'gift', 'giveaway', 'cashback'
    ],
  }
];

export function suggestCategoryLocal(
  note: string,
  categories: Category[],
  preferredType: TransactionType = 'expense'
): Category | null {
  if (!note || note.trim().length < 3) return null;

  const normalizedNote = note.toLowerCase().trim();
  let bestMatchCategoryName = '';
  let maxScore = 0;

  // 1. Score matching keywords
  for (const rule of KEYWORD_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (normalizedNote.includes(keyword)) {
        // Longer keyword matches get higher scores
        score += keyword.length;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatchCategoryName = rule.categoryName;
    }
  }

  if (maxScore === 0) return null;

  // 2. Find matching category in the user's category list
  const matched = categories.find(cat => 
    cat.name.toLowerCase() === bestMatchCategoryName.toLowerCase() &&
    cat.type === preferredType
  );

  if (matched) return matched;

  // Fallback to first available category of correct type if no exact match is active
  return null;
}
