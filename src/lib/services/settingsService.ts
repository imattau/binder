import { relayDefaultsService } from './relayDefaultsService';
import { userRelayService } from './userRelayService';
import { ok, fail, type Result } from '$lib/domain/result';
import type { RelaySetting } from '$lib/infra/storage/dexieDb';
import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';
import { pool, DEFAULT_RELAYS } from '$lib/infra/nostr/pool';

export const settingsService = {
    async getRelays(): Promise<Result<RelaySetting[]>> {
        const pubkey = get(authStore).pubkey;
        const userList = userRelayService.getRelays(pubkey);
        if (userList.length > 0) {
            return ok(userList);
        }
        return relayDefaultsService.getDefaults();
    },

    async setRelays(relays: RelaySetting[]): Promise<Result<void>> {
        const isDev = import.meta.env.DEV;
        
        for (const relay of relays) {
            try {
                const url = new URL(relay.url);
                if (url.protocol === 'wss:') {
                    continue;
                }
                if (url.protocol === 'ws:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
                    if (isDev) continue;
                    return fail({ message: `Insecure ws:// allowed only for localhost in dev mode: ${relay.url}` });
                }
                return fail({ message: `Invalid protocol for relay (must be wss://): ${relay.url}` });
            } catch (e) {
                 return fail({ message: `Invalid URL format: ${relay.url}` });
            }
        }
        
        return relayDefaultsService.setDefaults(relays);
    },

    // New: Sync from NIP-65 (Kind 10002)
    async syncRelaysFromNetwork(pubkey: string): Promise<Result<void>> {
        try {
            const event = await pool.get(DEFAULT_RELAYS, {
                kinds: [10002],
                authors: [pubkey]
            });

            if (event) {
                const networkRelays: RelaySetting[] = event.tags
                    .filter(t => t[0] === 'r')
                    .map(t => ({
                        url: t[1],
                        enabled: true
                    }));
                
                if (networkRelays.length > 0) {
                    return userRelayService.saveRelays(pubkey, networkRelays);
                }
            }
            
            return ok(undefined);

        } catch (e) {
            return fail({ message: 'Failed to sync relays', cause: e });
        }
    },

    async resetRelaysToDefaults(): Promise<Result<void>> {
        return relayDefaultsService.resetToDefaults();
    }
};
