import { db } from './dexieDb';
import type { DraftSnapshot } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';

export const snapshotRepo = {
    async getForChapter(chapterId: string): Promise<Result<DraftSnapshot[]>> {
        try {
            const snapshots = await db.snapshots
                .where('chapterId')
                .equals(chapterId)
                .reverse()
                .sortBy('createdAt');
            return ok(snapshots);
        } catch (e) {
            return fail({ message: 'Failed to load snapshots', cause: e });
        }
    },

    async getAll(): Promise<Result<DraftSnapshot[]>> {
        try {
            const snapshots = await db.snapshots.toArray();
            return ok(snapshots);
        } catch (e) {
            return fail({ message: 'Failed to load snapshots', cause: e });
        }
    },

    async save(snapshot: DraftSnapshot): Promise<Result<void>> {
        try {
            await db.snapshots.add(snapshot);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save snapshot', cause: e });
        }
    },

    async deleteMany(ids: string[]): Promise<Result<void>> {
        try {
            await db.snapshots.bulkDelete(ids);
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to delete snapshots', cause: e });
        }
    }
};
