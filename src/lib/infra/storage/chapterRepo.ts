import { db } from './dexieDb';
import type { LocalChapterDraft } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';

export const chapterRepo = {
    async getAllForBook(bookId: string): Promise<Result<LocalChapterDraft[]>> {
        try {
            const chapters = await db.chapters.where('bookId').equals(bookId).toArray();
            return ok(chapters);
        } catch (e) {
            return fail({ message: 'Failed to load chapters', cause: e });
        }
    },

    async get(id: string): Promise<Result<LocalChapterDraft | undefined>> {
        try {
            const chapter = await db.chapters.get(id);
            return ok(chapter);
        } catch (e) {
            return fail({ message: 'Failed to load chapter', cause: e });
        }
    },

    async save(chapter: LocalChapterDraft): Promise<Result<void>> {
        try {
            await db.chapters.put(chapter);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save chapter', cause: e });
        }
    },

    async delete(id: string): Promise<Result<void>> {
        try {
            await db.chapters.delete(id);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to delete chapter', cause: e });
        }
    },

    async deleteAllForBook(bookId: string): Promise<Result<void>> {
        try {
            await db.chapters.where('bookId').equals(bookId).delete();
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to delete chapters for book', cause: e });
        }
    }
};
