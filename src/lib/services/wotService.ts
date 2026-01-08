import { pool, getActiveRelays, fetchEvents } from '$lib/infra/nostr/pool';
import { signerService } from './signerService';
import { ok, fail, type Result } from '$lib/domain/result';
import type { NostrEvent } from 'nostr-tools';
import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';

export interface WoTState {
    follows: Set<string>;
    mutes: Set<string>;
    loaded: boolean;
}

export const wotService = {
    async getUserWoT(): Promise<Result<WoTState>> {
        // Only fetch if we have a logged-in user
        const auth = get(authStore);
        if (!auth.pubkey) {
            return ok({ follows: new Set(), mutes: new Set(), loaded: true });
        }

        const pubkey = auth.pubkey;
        const relays = await getActiveRelays();
        if (relays.length === 0) return fail({ message: 'No relays configured' });

        try {
            const events = await fetchEvents(relays, [{
                kinds: [3, 10000],
                authors: [pubkey]
            }]);

            const follows = new Set<string>();
            const mutes = new Set<string>();

            events.forEach(event => {
                if (event.kind === 3) {
                    event.tags.filter(t => t[0] === 'p').forEach(t => follows.add(t[1]));
                } else if (event.kind === 10000) {
                     event.tags.filter(t => t[0] === 'p').forEach(t => mutes.add(t[1]));
                }
            });

            return ok({ follows, mutes, loaded: true });
        } catch (e) {
            return fail({ message: 'Failed to fetch WoT data', cause: e });
        }
    },

    getTrustScore(pubkey: string, wot: WoTState): number {
        if (wot.mutes.has(pubkey)) return -1;
        if (wot.follows.has(pubkey)) return 2;
        return 0; // Neutral
    }
};