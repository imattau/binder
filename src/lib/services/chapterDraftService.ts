import { chapterRepo } from '$lib/infra/storage/chapterRepo';
import { bookRepo } from '$lib/infra/storage/bookRepo';
import type { LocalChapterDraft } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';
import { v4 as uuidv4 } from 'uuid';
import { draftSyncService } from './draftSyncService';

export const chapterDraftService = {
    async createChapter(bookId: string, title: string): Promise<Result<LocalChapterDraft>> {
        const bookRes = await bookRepo.get(bookId);
        if (!bookRes.ok || !bookRes.value) return fail({ message: 'Book not found' });
        
        const book = bookRes.value;
        const index = book.chapterOrder.length + 1;
        const d = `chapter-${String(index).padStart(2, '0')}-${uuidv4().slice(0, 4)}`;

        const chapter: LocalChapterDraft = {
            id: uuidv4(),
            d,
            bookId,
            title,
            contentMd: '',
            status: 'draft',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            publishedHash: undefined
        };

        const res = await chapterRepo.save(chapter);
        if (!res.ok) return fail(res.error);

        book.chapterOrder = [...book.chapterOrder, chapter.id];
        book.updatedAt = Date.now();
        await bookRepo.save(book);
        void draftSyncService.syncBook(bookId);

        return ok(chapter);
    },

    async getChapters(bookId: string): Promise<Result<LocalChapterDraft[]>> {
        return chapterRepo.getAllForBook(bookId);
    },

    async getChapter(id: string): Promise<Result<LocalChapterDraft | undefined>> {
        return chapterRepo.get(id);
    },

    async updateChapter(chapter: LocalChapterDraft): Promise<Result<void>> {
        chapter.updatedAt = Date.now();
        const res = await chapterRepo.save(chapter);
        if (res.ok) {
            void draftSyncService.syncBook(chapter.bookId);
        }
        return res;
    },
    
    async reorderChapters(bookId: string, newOrder: string[]): Promise<Result<void>> {
        const bookRes = await bookRepo.get(bookId);
        if (bookRes.ok && bookRes.value) {
            const book = bookRes.value;
            book.chapterOrder = newOrder;
            book.updatedAt = Date.now();
            const res = await bookRepo.save(book);
            if (res.ok) {
                void draftSyncService.syncBook(bookId);
            }
            return res;
        }
        return fail({ message: 'Book not found' });
    },

    async deleteChapter(chapterId: string): Promise<Result<void>> {
        const chapterRes = await chapterRepo.get(chapterId);
        if (!chapterRes.ok || !chapterRes.value) return fail({ message: 'Chapter not found' });
        const chapter = chapterRes.value;

        const deleteRes = await chapterRepo.delete(chapterId);
        if (!deleteRes.ok) return deleteRes;

        const bookRes = await bookRepo.get(chapter.bookId);
        if (bookRes.ok && bookRes.value) {
            const book = bookRes.value;
            book.chapterOrder = book.chapterOrder.filter(id => id !== chapterId);
            book.updatedAt = Date.now();
            await bookRepo.save(book);
            void draftSyncService.syncBook(book.id);
        }

        return ok(undefined);
    },

    async importChapter(bookId: string, title: string, contentMd: string, status: LocalChapterDraft['status'] = 'ready'): Promise<Result<LocalChapterDraft>> {
        const bookRes = await bookRepo.get(bookId);
        if (!bookRes.ok || !bookRes.value) return fail({ message: 'Book not found' });
        
        const book = bookRes.value;
        const index = book.chapterOrder.length + 1;
        const d = `chapter-${String(index).padStart(2, '0')}-${uuidv4().slice(0, 4)}`;

        const chapter: LocalChapterDraft = {
            id: uuidv4(),
            d,
            bookId,
            title,
            contentMd,
            status,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            publishedHash: undefined
        };

        const res = await chapterRepo.save(chapter);
        if (!res.ok) return fail(res.error);

        book.chapterOrder = [...book.chapterOrder, chapter.id];
        book.updatedAt = Date.now();
        await bookRepo.save(book);
        void draftSyncService.syncBook(bookId);

        return ok(chapter);
    }
};
