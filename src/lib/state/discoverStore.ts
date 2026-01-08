import { writable, get } from 'svelte/store';
import { discoverService } from '$lib/services/discoverService';
import { annotationService } from '$lib/services/annotationService';
import { wotStore } from './wotStore';
import { libraryStore } from './libraryStore';
import { authStore } from './authStore';
import type { FeedItem, GroupedFeedItem } from '$lib/domain/types';

interface DiscoverState {
    chapters: GroupedFeedItem[];
    books: FeedItem[];
    network: FeedItem[];
    global: FeedItem[]; // New global feed
    loading: boolean;
    lastLoaded: number | null;
    annotations: Record<string, number>;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function createDiscoverStore() {
    const { subscribe, set, update } = writable<DiscoverState>({
        chapters: [],
        books: [],
        network: [],
        global: [],
    loading: false,
    lastLoaded: null,
    annotations: {}
    });

    return {
        subscribe,
        load: async (force = false) => {
            const currentState = get({ subscribe });
            const now = Date.now();

            if (!force && currentState.lastLoaded && (now - currentState.lastLoaded < CACHE_TTL)) {
                return;
            }

            update(s => ({ ...s, loading: true, annotations: {} }));
            
            const auth = get(authStore);
            
            if (auth.pubkey) {
                // AUTHENTICATED FLOW
                await wotStore.load();
                await libraryStore.load();
                
                const chaptersRes = await discoverService.getFollowingChaptersFeed();
                if (chaptersRes.ok) update(s => ({ ...s, chapters: chaptersRes.value }));

                await new Promise(resolve => setTimeout(resolve, 0));

                const booksRes = await discoverService.getFollowingBooksFeed();
                if (booksRes.ok) update(s => ({ ...s, books: booksRes.value }));

                await new Promise(resolve => setTimeout(resolve, 0));

                const networkRes = await discoverService.getNetworkBooksShelf();
                if (networkRes.ok) update(s => ({ ...s, network: networkRes.value }));
                if (networkRes.ok && networkRes.value.length > 0) {
                    const bookDs = [...new Set(networkRes.value
                        .map(item => item.event.tags.find(t => t[0] === 'd')?.[1])
                        .filter((value): value is string => Boolean(value)))];

                    if (bookDs.length > 0) {
                        const annotationRes = await annotationService.getAnnotationCounts(bookDs);
                        if (annotationRes.ok) {
                            update(s => ({ ...s, annotations: annotationRes.value }));
                        }
                    }
                }
                
            } else {
                // GUEST FLOW
                const globalRes = await discoverService.getGlobalBooksFeed();
                if (globalRes.ok) update(s => ({ ...s, global: globalRes.value }));
            }

            update(s => ({ ...s, loading: false, lastLoaded: Date.now() }));
        }
    };
}

export const discoverStore = createDiscoverStore();
