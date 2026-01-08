import { writable } from 'svelte/store';
import { mediaSettingsService, DEFAULT_MEDIA_SERVERS } from '$lib/services/mediaSettingsService';
import type { MediaServerSetting } from '$lib/infra/storage/dexieDb';

function createMediaSettingsStore() {
    const { subscribe, set } = writable<MediaServerSetting[]>([]);

    return {
        subscribe,
        load: async () => {
            const res = await mediaSettingsService.getMediaServers();
            if (res.ok) {
                if (res.value.length === 0) {
                    await mediaSettingsService.resetToDefaults();
                    set(DEFAULT_MEDIA_SERVERS);
                } else {
                    set(res.value);
                }
            }
        },
        save: async (servers: MediaServerSetting[]) => {
            const res = await mediaSettingsService.setMediaServers(servers);
            if (res.ok) {
                set(servers);
            }
            return res;
        }
    };
}

export const mediaSettingsStore = createMediaSettingsStore();
