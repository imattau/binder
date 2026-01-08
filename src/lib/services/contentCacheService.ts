import { offlineRepo } from '$lib/infra/storage/offlineRepo';
import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { ok, fail, type Result } from '$lib/domain/result';
import type { NostrEvent } from 'nostr-tools';

export const contentCacheService = {
    async getBook(
        pubkey: string, 
        bookD: string, 
        mode: 'online' | 'offline' | 'prefer-offline' = 'prefer-offline'
    ): Promise<Result<NostrEvent>> {
        const id = `${pubkey}:${bookD}`;
        
        // Try Cache
        if (mode !== 'online') {
            const cached = await offlineRepo.getBook(id);
            if (cached.ok && cached.value) {
                return ok(cached.value.bookEvent);
            }
            if (mode === 'offline') return fail({ message: 'Book not found in cache' });
        }

        // Try Network
        const res = await subscriptions.fetchDiscoveryBooks([pubkey], 0);
        if (res.ok) {
            const event = res.value.find(e => e.tags.find(t => t[0] === 'd')?.[1] === bookD);
            if (event) return ok(event);
        }
        
        return fail({ message: 'Book not found' });
    },

    async getChapter(
        pubkey: string, 
        chapterD: string, 
        mode: 'online' | 'offline' | 'prefer-offline' = 'prefer-offline'
    ): Promise<Result<NostrEvent>> {
        const id = `${pubkey}:${chapterD}`;

        // Try Cache
        if (mode !== 'online') {
            const cached = await offlineRepo.getChapter(id);
            if (cached.ok && cached.value) {
                return ok(cached.value.chapterEvent);
            }
            if (mode === 'offline') return fail({ message: 'Chapter not found in cache' });
        }

        // Try Network
        const res = await subscriptions.fetchFeed({
            kinds: [30023],
            authors: [pubkey],
            '#d': [chapterD]
        });
        
        if (res.ok && res.value.length > 0) {
            return ok(res.value[0]);
        }

        return fail({ message: 'Chapter not found' });
    },
    async getChapterById(eventId: string): Promise<Result<NostrEvent>> {
        const res = await subscriptions.fetchFeed({
            kinds: [30023],
            ids: [eventId]
        });

        if (res.ok && res.value.length > 0) {
            return ok(res.value[0]);
        }

        return fail({ message: 'Chapter not found' });
    }
};
