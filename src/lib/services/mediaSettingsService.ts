import { db, type MediaServerSetting } from '$lib/infra/storage/dexieDb';
import { ok, fail, type Result } from '$lib/domain/result';

export const DEFAULT_MEDIA_SERVERS: MediaServerSetting[] = [
    {
        url: 'https://nostr.build',
        enabled: true,
        provider: 'standard'
    }
];

export const mediaSettingsService = {
    async getMediaServers(): Promise<Result<MediaServerSetting[]>> {
        try {
            const servers = await db.mediaServers.toArray();
            return ok(servers);
        } catch (e) {
            return fail({ message: 'Failed to load media server settings', cause: e });
        }
    },

    async setMediaServers(servers: MediaServerSetting[]): Promise<Result<void>> {
        try {
            // Unwrap proxies (Svelte 5)
            const plainServers = servers.map(s => ({ ...s }));
            await db.transaction('rw', db.mediaServers, async () => {
                await db.mediaServers.clear();
                await db.mediaServers.bulkAdd(plainServers);
            });
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to save media server settings', cause: e });
        }
    },

    async resetToDefaults(): Promise<Result<void>> {
        return this.setMediaServers(DEFAULT_MEDIA_SERVERS);
    }
};
