import { create } from 'zustand';

interface SecurityState {
  isLocked: boolean;
  isEnabled: boolean;
  pin: string | null;
  initialized: boolean;

  initialize: () => void;
  setPin: (pin: string) => void;
  verifyPin: (input: string) => boolean;
  disable: () => void;
  lock: () => void;
  unlock: () => void;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  isLocked: false,
  isEnabled: false,
  pin: null,
  initialized: false,

  initialize: () => {
    if (typeof window !== 'undefined') {
      const pin = localStorage.getItem('@finy/pin');
      const isEnabled = localStorage.getItem('@finy/pin_enabled') === 'true';
      
      set({ 
        pin, 
        isEnabled, 
        isLocked: isEnabled, // If security lock is active, lock on launch
        initialized: true 
      });
    }
  },

  setPin: (pin: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('@finy/pin', pin);
      localStorage.setItem('@finy/pin_enabled', 'true');
      set({ pin, isEnabled: true, isLocked: false });
    }
  },

  verifyPin: (input: string) => {
    const { pin } = get();
    if (!pin) return true;
    const isValid = pin === input;
    if (isValid) {
      set({ isLocked: false });
    }
    return isValid;
  },

  disable: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('@finy/pin');
      localStorage.setItem('@finy/pin_enabled', 'false');
      set({ pin: null, isEnabled: false, isLocked: false });
    }
  },

  lock: () => {
    const { isEnabled } = get();
    if (isEnabled) {
      set({ isLocked: true });
    }
  },

  unlock: () => {
    set({ isLocked: false });
  }
}));
