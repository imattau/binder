import { pool } from '$lib/infra/nostr/pool';
import { ok, fail, type Result } from '$lib/domain/result';
import type { NostrEvent } from 'nostr-tools';

const KIND_RELAY_LIST = 10002;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

interface CachedRelayList {
    relays: string[];
    timestamp: number;
}

const relayCache: Map<string, CachedRelayList> = new Map();

export const relayDiscoveryService = {
    async getRelaysForAuthor(pubkey: string, defaultRelays: string[]): Promise<string[]> {
        // Check cache
        const cached = relayCache.get(pubkey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return cached.relays;
        }

        try {
            // Fetch from default relays
            const event = await pool.get(defaultRelays, {
                kinds: [KIND_RELAY_LIST],
                authors: [pubkey]
            });

            if (event) {
                const relays = event.tags
                    .filter(t => t[0] === 'r' && (t.length === 2 || t[2] === 'read' || t[2] === 'write')) // Simplification: accept all for now
                    .map(t => t[1]);
                
                if (relays.length > 0) {
                    relayCache.set(pubkey, { relays, timestamp: Date.now() });
                    return relays;
                }
            }
        } catch (e) {
            console.warn(`Failed to fetch relay list for ${pubkey}`, e);
        }

        return [];
    },

    async getMergedRelays(authors: string[], userRelays: string[]): Promise<string[]> {
        const uniqueRelays = new Set<string>(userRelays);
        
        // Limit to first 5 authors to avoid flooding if fetching for many
        const targetAuthors = authors.slice(0, 5); 
        
        await Promise.all(targetAuthors.map(async (pubkey) => {
            const authorRelays = await this.getRelaysForAuthor(pubkey, userRelays);
            authorRelays.forEach(r => uniqueRelays.add(r));
        }));

        return Array.from(uniqueRelays);
    }
};
