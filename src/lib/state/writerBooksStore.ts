import { writable } from 'svelte/store';
import { bookService } from '$lib/services/bookService';
import type { LocalBook } from '$lib/domain/types';

function createWriterBooksStore() {
    const { subscribe, set, update } = writable<LocalBook[]>([]);

    return {
        subscribe,
        load: async () => {
            const res = await bookService.getBooks();
            if (res.ok) {
                set(res.value);
            }
        },
        add: (book: LocalBook) => update(books => [book, ...books]),
        remove: (id: string) => update(books => books.filter(b => b.id !== id)),
        reset: () => set([])
    };
}

export const writerBooksStore = createWriterBooksStore();
