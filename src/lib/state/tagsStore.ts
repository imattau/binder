import { writable } from 'svelte/store';
import { tagService } from '$lib/services/tagService';
import type { FeedItem } from '$lib/domain/types';

interface TagsState {
    tag: string | null;
    books: FeedItem[];
    chapters: FeedItem[];
    loading: boolean;
}

function createTagsStore() {
    const { subscribe, set, update } = writable<TagsState>({
        tag: null,
        books: [],
        chapters: [],
        loading: false
    });

    return {
        subscribe,
        load: async (tag: string) => {
            update(s => ({ ...s, loading: true, tag }));
            const res = await tagService.getTagFeed(tag);
            if (res.ok) {
                set({
                    tag,
                    books: res.value.books,
                    chapters: res.value.chapters,
                    loading: false
                });
            } else {
                update(s => ({ ...s, loading: false }));
            }
        }
    };
}

export const tagsStore = createTagsStore();
