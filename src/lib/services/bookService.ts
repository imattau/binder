import { bookRepo } from '$lib/infra/storage/bookRepo';
import { chapterRepo } from '$lib/infra/storage/chapterRepo';
import { syncStatusStore } from '$lib/state/syncStatusStore';
import type { LocalBook } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';
import { v4 as uuidv4 } from 'uuid';
import { draftSyncService } from './draftSyncService';

export const bookService = {
    async createBook(title: string, summary?: string, cover?: string): Promise<Result<LocalBook>> {
        const slug = title.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
        const shortId = uuidv4().slice(0, 8);
        const d = `book-${slug}-${shortId}`;
        
        const book: LocalBook = {
            id: uuidv4(),
            d,
            title,
            summary,
            cover,
            tags: [],
            topics: [],
            coAuthors: [],
            chapterOrder: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            publishedHash: undefined
        };
        
        const res = await bookRepo.save(book);
        if (!res.ok) return fail(res.error);
        
        void draftSyncService.syncBook(book.id);
        return ok(book);
    },

    async getBooks(): Promise<Result<LocalBook[]>> {
        return bookRepo.getAll();
    },

    async getBook(id: string): Promise<Result<LocalBook | undefined>> {
        return bookRepo.get(id);
    },

    async updateBook(book: LocalBook): Promise<Result<void>> {
        book.updatedAt = Date.now();
        const res = await bookRepo.save(book);
        if (!res.ok) return res;
        void draftSyncService.syncBook(book.id);
        syncStatusStore.markDirty(book.id);
        return res;
    },

    async deleteBook(id: string): Promise<Result<void>> {
        const bookRes = await bookRepo.get(id);
        if (!bookRes.ok || !bookRes.value) return fail({ message: 'Book not found' });

        const deleteChRes = await chapterRepo.deleteAllForBook(id);
        if (!deleteChRes.ok) return deleteChRes;

        const res = await bookRepo.delete(id);
        if (!res.ok) return res;

        void draftSyncService.notifyBookDeletion(bookRes.value);
        return ok(undefined);
    }
};
