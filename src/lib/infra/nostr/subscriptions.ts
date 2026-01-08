import { pool, getActiveRelays } from './pool';
import type { Filter, NostrEvent } from 'nostr-tools';
import { ok, fail, type Result } from '$lib/domain/result';
import { relayDiscoveryService } from '$lib/services/relayDiscoveryService';

export const subscriptions = {
    async fetchFeed(filter: Filter, limit = 20): Promise<Result<NostrEvent[]>> {
        let relays = await getActiveRelays();
        if (relays.length === 0) return fail({ message: 'No relays configured' });

        // NIP-65 Optimization: If authors are specified, include their preferred relays
        if (filter.authors && filter.authors.length > 0) {
            relays = await relayDiscoveryService.getMergedRelays(filter.authors, relays);
        }

        try {
            const events = await pool.querySync(relays, {
                ...filter,
                limit
            });
            
            // Sort by created_at desc
            return ok(events.sort((a, b) => b.created_at - a.created_at));
        } catch (e) {
            return fail({ message: 'Feed fetch failed', cause: e });
        }
    },

    async fetchDiscoveryChapters(authors: string[], since: number): Promise<Result<NostrEvent[]>> {
        if (authors.length === 0) return ok([]);
        return this.fetchFeed({
            kinds: [30023],
            authors,
            since
        });
    },

    async fetchDiscoveryBooks(authors: string[], since: number): Promise<Result<NostrEvent[]>> {
        if (authors.length === 0) return ok([]);
        return this.fetchFeed({
            kinds: [30003],
            authors,
            since
        });
    },
    
    async fetchAnnotationsForBooks(bookDs: string[]): Promise<Result<NostrEvent[]>> {
        if (bookDs.length === 0) return ok([]);
        return this.fetchFeed({
            kinds: [30014],
            '#book': bookDs
        }, 100);
    },
    
    async fetchByTag(tag: string, kind: number): Promise<Result<NostrEvent[]>> {
        return this.fetchFeed({
            kinds: [kind],
            '#t': [tag]
        });
    },

    async fetchMetadata(authors: string[]): Promise<Result<NostrEvent[]>> {
        if (authors.length === 0) return ok([]);
        return this.fetchFeed({
            kinds: [0],
            authors
        });
    }
};
