import { writable } from 'svelte/store';

type SyncStatus = {
  dirty: boolean;
  lastSyncedAt: number | null;
};

const { subscribe, update } = writable<Record<string, SyncStatus>>({});

function markDirty(bookId: string) {
  update((state) => ({
    ...state,
    [bookId]: {
      dirty: true,
      lastSyncedAt: state[bookId]?.lastSyncedAt ?? null
    }
  }));
}

function markSynced(bookId: string) {
  update((state) => ({
    ...state,
    [bookId]: {
      dirty: false,
      lastSyncedAt: Date.now()
    }
  }));
}

export const syncStatusStore = {
  subscribe,
  markDirty,
  markSynced
};
