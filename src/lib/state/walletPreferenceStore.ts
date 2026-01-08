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
