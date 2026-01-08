import { writable } from 'svelte/store';
import { libraryService } from '$lib/services/libraryService';
import type { SavedBook, Shelf } from '$lib/domain/types';
import { librarySyncService } from '$lib/services/librarySyncService';
import { libraryRepo } from '$lib/infra/storage/libraryRepo';

interface LibraryState {
    shelves: Shelf[];
    books: SavedBook[];
    loading: boolean;
}

async function loadLibraryData() {
    const shelvesRes = await libraryService.getShelves();
    const booksRes = await libraryRepo.getSavedBooks();
    return {
        shelves: shelvesRes.ok ? shelvesRes.value : [],
        books: booksRes.ok ? booksRes.value : []
    };
}

function createLibraryStore() {
    const { subscribe, set, update } = writable<LibraryState>({
        shelves: [],
        books: [],
        loading: false
    });

    return {
        subscribe,
        load: async () => {
            update(s => ({ ...s, loading: true }));
            await libraryService.initializeDefaults();
            const baseData = await loadLibraryData();
            set({
                shelves: baseData.shelves,
                books: baseData.books,
                loading: false
            });
            const syncRes = await librarySyncService.restoreLatestSnapshot();
            if (syncRes.ok && syncRes.value) {
                const synced = await loadLibraryData();
                set({
                    shelves: synced.shelves,
                    books: synced.books,
                    loading: false
                });
            }
        },
        createShelf: async (name: string) => {
            const res = await libraryService.createShelf(name);
            if (res.ok) {
                update(s => ({ ...s, shelves: [...s.shelves, res.value] }));
                const syncRes = await librarySyncService.publishLibrarySnapshot();
                if (!syncRes.ok) {
                    console.warn('Library sync publish failed', syncRes.error);
                }
            }
            return res;
        },
        toggleShelf: async (book: SavedBook, shelfId: string) => {
            let updatedBook: SavedBook | null = null;
            update(s => {
                const books = [...s.books];
                const index = books.findIndex(b => b.id === book.id);
                if (index >= 0) {
                    const existing = books[index];
                    const inShelf = existing.shelves.includes(shelfId);
                    const newShelves = inShelf
                        ? existing.shelves.filter(id => id !== shelfId)
                        : [...existing.shelves, shelfId];
                    const refreshed = { ...existing, shelves: newShelves };
                    books[index] = refreshed;
                    updatedBook = refreshed;
                } else {
                    const newBook = { ...book, shelves: [shelfId], addedAt: Date.now() };
                    books.push(newBook);
                    updatedBook = newBook;
                }
                return { ...s, books };
            });

            if (updatedBook) {
                const res = await libraryService.saveBookToLibrary(updatedBook);
                if (!res.ok) {
                    console.warn('Failed to persist library book', res.error);
                }
                const syncRes = await librarySyncService.publishLibrarySnapshot();
                if (!syncRes.ok) {
                    console.warn('Library sync publish failed', syncRes.error);
                }
            }
        },
        upsertBook: (book: SavedBook) => {
            update(s => {
                const books = [...s.books];
                const index = books.findIndex(b => b.id === book.id);
                if (index >= 0) {
                    books[index] = book;
                } else {
                    books.push(book);
                }
                return { ...s, books };
            });
        }
    };
}

export const libraryStore = createLibraryStore();
