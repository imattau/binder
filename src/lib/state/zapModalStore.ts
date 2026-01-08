import { writable } from 'svelte/store';

interface ZapTarget {
  type: 'profile' | 'event';
  pubkey: string;
  eventId?: string;
  coordinates?: string; // kind:pubkey:d
}

interface ZapModalState {
  open: boolean;
  target?: ZapTarget;
  name?: string;
}

const { subscribe, set, update } = writable<ZapModalState>({
  open: false
});

export const zapModalStore = {
  subscribe,
  open: (target: ZapTarget, name?: string) => set({ open: true, target, name }),
  close: () => update(s => ({ ...s, open: false }))
};
