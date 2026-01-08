import { db } from './dexieDb';
import type { SavedBook, ReadingProgress, Shelf } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';

export const libraryRepo = {
    // Saved Books
    async saveBook(book: SavedBook): Promise<Result<void>> {
        try {
            await db.savedBooks.put(book);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save book', cause: e });
        }
    },
    
    async getSavedBooks(): Promise<Result<SavedBook[]>> {
         try {
            const books = await db.savedBooks.orderBy('addedAt').reverse().toArray();
            return ok(books);
        } catch (e) {
            return fail({ message: 'Failed to get saved books', cause: e });
        }
    },

    async getSavedBook(id: string): Promise<Result<SavedBook | undefined>> {
         try {
            const book = await db.savedBooks.get(id);
            return ok(book);
        } catch (e) {
            return fail({ message: 'Failed to get saved book', cause: e });
        }
    },
    
    async removeBook(id: string): Promise<Result<void>> {
         try {
            await db.savedBooks.delete(id);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to remove book', cause: e });
        }
    },

    // Shelves
    async getShelves(): Promise<Result<Shelf[]>> {
        try {
            const shelves = await db.shelves.toArray();
            return ok(shelves);
        } catch (e) {
            return fail({ message: 'Failed to get shelves', cause: e });
        }
    },

    async saveShelf(shelf: Shelf): Promise<Result<void>> {
        try {
            await db.shelves.put(shelf);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save shelf', cause: e });
        }
    },

    // Reading Progress
    async saveProgress(progress: ReadingProgress): Promise<Result<void>> {
        try {
            await db.readingProgress.put(progress);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save progress', cause: e });
        }
    },

    async getProgress(bookId: string): Promise<Result<ReadingProgress | undefined>> {
         try {
            const progress = await db.readingProgress.get(bookId);
            return ok(progress);
        } catch (e) {
            return fail({ message: 'Failed to get progress', cause: e });
        }
    },

    async getAllProgress(): Promise<Result<ReadingProgress[]>> {
         try {
            const progress = await db.readingProgress.toArray();
            return ok(progress);
        } catch (e) {
            return fail({ message: 'Failed to fetch reading progress', cause: e });
        }
    }
};
