import { db, type RelaySetting } from './dexieDb';
import { ok, fail, type Result } from '$lib/domain/result';

export const relaySettingsRepo = {
    async getAll(): Promise<Result<RelaySetting[]>> {
        try {
            const relays = await db.relays.toArray();
            return ok(relays);
        } catch (e) {
            return fail({ message: 'Failed to load relay settings', cause: e });
        }
    },

    async save(relays: RelaySetting[]): Promise<Result<void>> {
        try {
            await db.transaction('rw', db.relays, async () => {
                await db.relays.clear();
                await db.relays.bulkAdd(relays);
            });
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save relay settings', cause: e });
        }
    },
    
    async checkDb(): Promise<boolean> {
        try {
            await db.open();
            return true;
        } catch {
            return false;
        }
    }
};
