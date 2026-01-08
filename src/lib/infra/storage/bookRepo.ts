import { db } from './dexieDb';
import type { LocalBook } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';

export const bookRepo = {
    async getAll(): Promise<Result<LocalBook[]>> {
        try {
            const books = await db.books.orderBy('updatedAt').reverse().toArray();
            return ok(books);
        } catch (e) {
            return fail({ message: 'Failed to load books', cause: e });
        }
    },

    async get(id: string): Promise<Result<LocalBook | undefined>> {
        try {
            const book = await db.books.get(id);
            return ok(book);
        } catch (e) {
            return fail({ message: 'Failed to load book', cause: e });
        }
    },

    async save(book: LocalBook): Promise<Result<void>> {
        try {
            await db.books.put(book);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save book', cause: e });
        }
    },

    async delete(id: string): Promise<Result<void>> {
        try {
            await db.books.delete(id);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to delete book', cause: e });
        }
    }
};
