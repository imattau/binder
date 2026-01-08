import { libraryRepo } from '$lib/infra/storage/libraryRepo';
import type { SavedBook, Shelf, ReadingProgress } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';
import { v4 as uuidv4 } from 'uuid';

export const libraryService = {
    async initializeDefaults(): Promise<Result<void>> {
        const shelvesRes = await libraryRepo.getShelves();
        if (shelvesRes.ok && shelvesRes.value.length === 0) {
            // Create default shelves
            const defaults = [
                { id: 'favorites', name: 'Favorites', isSystem: true, createdAt: Date.now() },
                { id: 'toread', name: 'To Read', isSystem: true, createdAt: Date.now() },
                { id: 'reading', name: 'Reading', isSystem: true, createdAt: Date.now() },
                { id: 'finished', name: 'Finished', isSystem: true, createdAt: Date.now() }
            ];
            for (const s of defaults) {
                await libraryRepo.saveShelf(s);
            }
        }
        return ok(undefined);
    },

    async saveBookToLibrary(
        book: { kind: number; pubkey: string; d: string; title: string; summary?: string; coverUrl?: string }, 
        shelfId?: string
    ): Promise<Result<void>> {
        const id = `${book.kind}:${book.pubkey}:${book.d}`;
        
        // Check if exists
        const existing = await libraryRepo.getSavedBook(id);
        let shelves = existing.ok && existing.value ? existing.value.shelves : [];
        
        if (shelfId && !shelves.includes(shelfId)) {
            shelves.push(shelfId);
        }

        const savedBook: SavedBook = {
            id,
            kind: book.kind,
            pubkey: book.pubkey,
            d: book.d,
            title: book.title,
            summary: book.summary,
            coverUrl: book.coverUrl,
            shelves,
            addedAt: Date.now()
        };

        return libraryRepo.saveBook(savedBook);
    },

    async removeBookFromLibrary(id: string): Promise<Result<void>> {
        return libraryRepo.removeBook(id);
    },

    async createShelf(name: string): Promise<Result<Shelf>> {
        const shelf: Shelf = {
            id: uuidv4(),
            name,
            isSystem: false,
            createdAt: Date.now()
        };
        const res = await libraryRepo.saveShelf(shelf);
        if (!res.ok) return fail(res.error);
        return ok(shelf);
    },

    async getShelves(): Promise<Result<Shelf[]>> {
        return libraryRepo.getShelves();
    },

    async getBooksInShelf(shelfId: string): Promise<Result<SavedBook[]>> {
        const all = await libraryRepo.getSavedBooks();
        if (!all.ok) return fail(all.error);
        
        // Dexie filtering
        // We could optimize this with multiEntry index in repo, but array filter is fine for small libraries
        return ok(all.value.filter(b => b.shelves.includes(shelfId)));
    },
    
    async updateProgress(bookId: string, chapterId: string, percent: number): Promise<Result<void>> {
        const progress: ReadingProgress = {
            bookId,
            lastChapterId: chapterId,
            percent,
            updatedAt: Date.now()
        };
        return libraryRepo.saveProgress(progress);
    },
    async getProgress(bookId: string): Promise<Result<ReadingProgress | undefined>> {
        return libraryRepo.getProgress(bookId);
    },
    async removeBookFromShelf(bookId: string, shelfId: string): Promise<Result<void>> {
        const existingRes = await libraryRepo.getSavedBook(bookId);
        if (!existingRes.ok) {
            return fail(existingRes.error);
        }
        const book = existingRes.value;
        if (!book || !book.shelves.includes(shelfId)) {
            return ok(undefined);
        }
        const updated: SavedBook = {
            ...book,
            shelves: book.shelves.filter(id => id !== shelfId)
        };
        return libraryRepo.saveBook(updated);
    },
    async getSavedBook(bookId: string): Promise<Result<SavedBook | undefined>> {
        return libraryRepo.getSavedBook(bookId);
    }
};
