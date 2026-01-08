import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { wotService } from './wotService';
import { wotStore } from '$lib/state/wotStore'; // Access store for current WoT state
import { get } from 'svelte/store';
import { ok, fail, type Result } from '$lib/domain/result';
import type { FeedItem, GroupedFeedItem, AuthorProfile } from '$lib/domain/types';
import type { NostrEvent } from 'nostr-tools';

// Helper to distinguish Binder Books (TOCs) from generic NIP-51 lists
function isBook(event: NostrEvent): boolean {
    if (event.kind !== 30003) return false;

    // Primary Signal: Specific Binder tag
    const isBinderNative = event.tags.some(t => t[0] === 't' && t[1] === 'binder-book');
    
    const hasTitle = event.tags.some(t => t[0] === 'title');
    if (!hasTitle && !isBinderNative) return false;

    // Strict Check: Must contain at least one Chapter (30023) by the SAME AUTHOR
    // This aligns with the reader's security policy and ensures we don't show empty "Reading Lists".
    const hasValidChapter = event.tags.some(t => {
        if (t[0] !== 'a') return false;
        const parts = t[1].split(':');
        if (parts.length < 3) return false;
        
        const [kind, pubkey] = parts;
        return kind === '30023' && pubkey === event.pubkey;
    });
    
    return hasValidChapter || isBinderNative;
}

export const discoverService = {
    async getFollowingChaptersFeed(): Promise<Result<GroupedFeedItem[]>> {
        const wot = get(wotStore);
        if (!wot.loaded) await wotService.getUserWoT(); // Ensure loaded
        
        const follows = Array.from(get(wotStore).follows);
        if (follows.length === 0) return ok([]);

        const since = Math.floor(Date.now() / 1000) - (14 * 24 * 60 * 60); // 14 days
        
        // 1. Fetch Chapters
        const res = await subscriptions.fetchDiscoveryChapters(follows, since);
        if (!res.ok) return fail(res.error);
        const chapters = res.value;

        if (chapters.length === 0) return ok([]);

        // 2. Fetch Authors Metadata
        const authorPubkeys = [...new Set(chapters.map(e => e.pubkey))];
        const metaRes = await subscriptions.fetchMetadata(authorPubkeys);
        const metadataMap = new Map<string, AuthorProfile>();

        if (metaRes.ok) {
            const sortedMeta = metaRes.value.sort((a, b) => b.created_at - a.created_at);
            for (const event of sortedMeta) {
                if (metadataMap.has(event.pubkey)) continue;
                try {
                    const content = JSON.parse(event.content);
                    metadataMap.set(event.pubkey, {
                        pubkey: event.pubkey,
                        name: content.name,
                        displayName: content.display_name,
                        picture: content.picture,
                        about: content.about,
                        nip05: content.nip05
                    });
                } catch (e) { }
            }
        }

        // 3. Group by Author
        const grouped: Record<string, GroupedFeedItem> = {};

        for (const event of chapters) {
            if (!grouped[event.pubkey]) {
                const profile = metadataMap.get(event.pubkey) || { pubkey: event.pubkey };
                grouped[event.pubkey] = {
                    author: profile,
                    chapters: [],
                    lastUpdated: 0
                };
            }
            
            if (grouped[event.pubkey].chapters.length < 3) {
                grouped[event.pubkey].chapters.push({
                    event,
                    type: 'chapter',
                    reason: 'From your follows'
                });
            }
            
            if (event.created_at > grouped[event.pubkey].lastUpdated) {
                grouped[event.pubkey].lastUpdated = event.created_at;
            }
        }

        const sortedGroups = Object.values(grouped).sort((a, b) => b.lastUpdated - a.lastUpdated);
        return ok(sortedGroups);
    },

    async getFollowingBooksFeed(): Promise<Result<FeedItem[]>> {
        const follows = Array.from(get(wotStore).follows);
        if (follows.length === 0) return ok([]);
        
        const since = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60); // 30 days

        const res = await subscriptions.fetchDiscoveryBooks(follows, since);
        if (!res.ok) return fail(res.error);

        const items: FeedItem[] = res.value
            .filter(isBook)
            .map(e => ({
                event: e,
                type: 'book',
                reason: 'New book from follows'
            }));

        return ok(items);
    },

    async getNetworkBooksShelf(): Promise<Result<FeedItem[]>> {
        const res = await subscriptions.fetchFeed({
            kinds: [30003],
            limit: 30 
        });
        
        if (!res.ok) return fail(res.error);

        const wot = get(wotStore);
        const items: FeedItem[] = [];
        
        for (const e of res.value) {
            if (!isBook(e)) continue;

            const score = wotService.getTrustScore(e.pubkey, wot);
            if (score >= 0) {
                items.push({
                    event: e,
                    type: 'book',
                    reason: wot.follows.has(e.pubkey) ? 'From your network' : 'Recently published',
                    score
                });
            }
        }

        return ok(items.slice(0, 20));
    },

    async getGlobalBooksFeed(): Promise<Result<FeedItem[]>> {
        const res = await subscriptions.fetchFeed({
            kinds: [30003],
            limit: 20
        });

        if (!res.ok) return fail(res.error);

        const items: FeedItem[] = res.value
            .filter(isBook)
            .map(e => ({
                event: e,
                type: 'book',
                reason: 'Latest on Binder'
            }));

        return ok(items);
    }
};