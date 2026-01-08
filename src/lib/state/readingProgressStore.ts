import { writable } from 'svelte/store';
import { libraryService } from '$lib/services/libraryService';
import type { ReadingProgress } from '$lib/domain/types';

const progressState = writable<Record<string, ReadingProgress>>({});

export const readingProgressStore = {
    subscribe: progressState.subscribe,
    async load(bookId: string) {
        const res = await libraryService.getProgress(bookId);
        progressState.update((current) => {
            const next = { ...current };
            if (res.ok && res.value) {
                next[bookId] = res.value;
            } else {
                delete next[bookId];
            }
            return next;
        });
        return res;
    },
    setProgress(bookId: string, progress: ReadingProgress) {
        progressState.update((current) => ({ ...current, [bookId]: progress }));
    },
    clearProgress(bookId: string) {
        progressState.update((current) => {
            const next = { ...current };
            delete next[bookId];
            return next;
        });
    }
};
