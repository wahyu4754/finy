import { useAuthStore } from '../store/auth';
import { usePurchasesStore } from '../store/purchases';

export function useFeatureAccess() {
  const { user } = useAuthStore();
  const { isVip: storeIsVip } = usePurchasesStore();

  const isVip = storeIsVip || !!user?.is_vip;

  const hasAccess = (feature: string): boolean => {
    if (isVip) return true;
    
    // Free features allowed
    const freeFeatures = [
      'basic_transactions',
      'basic_wallets',
      'basic_stats'
    ];
    
    return freeFeatures.includes(feature);
  };

  const maxWallets = isVip ? Infinity : 2;
  const maxCategories = isVip ? Infinity : 10;
  const hasAiAccess = isVip || (user?.ai_credits ?? 0) > 0;

  return {
    hasAccess,
    maxWallets,
    maxCategories,
    hasAiAccess,
    isVip
  };
}
