import type { RelaySetting } from '$lib/infra/storage/dexieDb';
import { ok, fail, type Result } from '$lib/domain/result';

const STORAGE_KEY = 'binder_user_relays';

function userKey(pubkey: string): string {
  return `${STORAGE_KEY}:${pubkey}`;
}

function parseStored(value: string | null): RelaySetting[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export const userRelayService = {
  getRelays(pubkey?: string | null): RelaySetting[] {
    if (!pubkey || typeof window === 'undefined') return [];
    const stored = localStorage.getItem(userKey(pubkey));
    return parseStored(stored);
  },

  saveRelays(pubkey: string | null, relays: RelaySetting[]): Result<void> {
    if (!pubkey || typeof window === 'undefined') {
      return fail({ message: 'User not authenticated' });
    }
    try {
      localStorage.setItem(userKey(pubkey), JSON.stringify(relays));
      return ok(undefined);
    } catch (e: any) {
      return fail({ message: 'Failed to persist user relays', cause: e });
    }
  }
};
