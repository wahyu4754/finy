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
    if (typeof window === 'undefined') return;
    // Idempotent on purpose: only a cold start may engage the lock. Because AppShell
    // renders <AppLock/> in place of the whole tree while isLocked, and /security called
    // initialize() on mount, unlocking remounted the page which re-locked it — an
    // infinite loop that stranded users on the only screen holding the disable toggle.
    if (get().initialized) return;

    const pin = localStorage.getItem('@finy/pin');
    const isEnabled = localStorage.getItem('@finy/pin_enabled') === 'true';

    set({
      pin,
      isEnabled,
      isLocked: isEnabled, // If security lock is active, lock on launch
      initialized: true
    });
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
