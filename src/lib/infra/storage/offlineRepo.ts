import { db } from './dexieDb';
import type { PublishedBook, PublishedChapter, OfflineJob } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';

export const offlineRepo = {
    // Books
    async saveBook(book: PublishedBook): Promise<Result<void>> {
        try {
            await db.publishedBooks.put(book);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save published book', cause: e });
        }
    },

    async getBook(id: string): Promise<Result<PublishedBook | undefined>> {
        try {
            const book = await db.publishedBooks.get(id);
            return ok(book);
        } catch (e) {
            return fail({ message: 'Failed to get published book', cause: e });
        }
    },

    // Chapters
    async saveChapter(chapter: PublishedChapter): Promise<Result<void>> {
        try {
            await db.publishedChapters.put(chapter);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save published chapter', cause: e });
        }
    },

    async getChapter(id: string): Promise<Result<PublishedChapter | undefined>> {
        try {
            const chapter = await db.publishedChapters.get(id);
            return ok(chapter);
        } catch (e) {
            return fail({ message: 'Failed to get published chapter', cause: e });
        }
    },

    async getChapters(ids: string[]): Promise<Result<PublishedChapter[]>> {
        try {
            const chapters = await db.publishedChapters.bulkGet(ids);
            return ok(chapters.filter((c): c is PublishedChapter => !!c));
        } catch (e) {
            return fail({ message: 'Failed to get published chapters', cause: e });
        }
    },

    // Jobs
    async saveJob(job: OfflineJob): Promise<Result<void>> {
        try {
            await db.offlineJobs.put(job);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save offline job', cause: e });
        }
    },

    async getJob(id: string): Promise<Result<OfflineJob | undefined>> {
        try {
            const job = await db.offlineJobs.get(id);
            return ok(job);
        } catch (e) {
            return fail({ message: 'Failed to get offline job', cause: e });
        }
    },
    
    async getPendingJobs(): Promise<Result<OfflineJob[]>> {
        try {
            const jobs = await db.offlineJobs.where('status').equals('pending').toArray();
            return ok(jobs);
        } catch (e) {
            return fail({ message: 'Failed to get pending jobs', cause: e });
        }
    }
};
