import { writable } from 'svelte/store';

export type WalletPreference = 'nip07' | 'nip46' | 'external';

const STORAGE_KEY = 'binder_wallet_preference';

function getInitialPreference(): WalletPreference {
  if (typeof window === 'undefined') {
    return 'nip07';
  }
  const stored = localStorage.getItem(STORAGE_KEY) as WalletPreference | null;
  if (stored === 'nip07' || stored === 'nip46' || stored === 'external') {
    return stored;
  }
  return 'nip07';
}

const preference = getInitialPreference();
const preferenceStore = writable<WalletPreference>(preference);
let currentPreference: WalletPreference = preference;

const ZAP_AMOUNT_KEY = 'binder_last_zap_amount';
const lastZapAmountStore = writable<number>(100);

function initializeZapAmount() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ZAP_AMOUNT_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lastZapAmountStore.set(parsed);
      }
    }
  }
}

initializeZapAmount();

function persistPreference(pref: WalletPreference) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, pref);
}

export const walletPreferenceStore = {
  subscribe: preferenceStore.subscribe,
  setPreference(pref: WalletPreference) {
    currentPreference = pref;
    preferenceStore.set(pref);
    persistPreference(pref);
  },
  get current() {
    return currentPreference;
  }
};

export const zapPreferenceStore = {
  subscribe: lastZapAmountStore.subscribe,
  setAmount(amount: number) {
    lastZapAmountStore.set(amount);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ZAP_AMOUNT_KEY, amount.toString());
    }
  }
};
