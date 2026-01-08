import { snapshotRepo } from '$lib/infra/storage/snapshotRepo';
import type { DraftSnapshot } from '$lib/domain/types';
import { ok, fail, type Result } from '$lib/domain/result';
import { v4 as uuidv4 } from 'uuid';

export const snapshotService = {
    async createSnapshot(chapterId: string, contentMd: string, reason: string): Promise<Result<DraftSnapshot>> {
        const snapshot: DraftSnapshot = {
            id: uuidv4(),
            chapterId,
            contentMd,
            reason,
            createdAt: Date.now()
        };
        
        const res = await snapshotRepo.save(snapshot);
        if (!res.ok) return fail(res.error);
        void trimSnapshots(chapterId);
        
        return ok(snapshot);
    },

    async getSnapshots(chapterId: string): Promise<Result<DraftSnapshot[]>> {
        return snapshotRepo.getForChapter(chapterId);
    }
};

async function trimSnapshots(chapterId: string) {
    const limitPerChapter = 30;
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

    const res = await snapshotRepo.getForChapter(chapterId);
    if (!res.ok) return;

    const now = Date.now();
    const staleIds: string[] = [];

    for (const snapshot of res.value) {
        if (now - snapshot.createdAt > maxAgeMs) {
            staleIds.push(snapshot.id);
        }
    }

    const sortedByDate = [...res.value].sort((a, b) => a.createdAt - b.createdAt);
    if (sortedByDate.length > limitPerChapter) {
        const extra = sortedByDate.slice(0, sortedByDate.length - limitPerChapter);
        for (const snapshot of extra) {
            if (!staleIds.includes(snapshot.id)) {
                staleIds.push(snapshot.id);
            }
        }
    }

    if (staleIds.length > 0) {
        await snapshotRepo.deleteMany(staleIds);
    }
}
