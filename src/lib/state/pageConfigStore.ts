import { writable, get } from 'svelte/store';
import { pageConfigService, type PageConfig } from '$lib/services/pageConfigService';

const { subscribe, set, update } = writable<PageConfig>(pageConfigService.getConfig());

export const pageConfigStore = {
    subscribe,
    refresh: () => {
        const config = pageConfigService.getConfig();
        set(config);
        return config;
    },
    setConfig: (config: PageConfig) => {
        pageConfigService.saveConfig(config);
        set(config);
        // Sync in background
        pageConfigService.syncToNetwork(config).catch(err => console.warn('Failed to sync config', err));
    },
    updateConfig: (partial: Partial<PageConfig>) => {
        update(current => {
            const next = { ...current, ...partial };
            pageConfigService.saveConfig(next);
            pageConfigService.syncToNetwork(next).catch(err => console.warn('Failed to sync config', err));
            return next;
        });
    },
    loadFromNetwork: async (pubkey: string) => {
        const res = await pageConfigService.fetchFromNetwork(pubkey);
        if (res.ok && res.value) {
            const remote = res.value;
            const local = get({ subscribe });
            
            // Conflict resolution: prioritize remote if newer or local is empty/old
            if (!local.lastUpdated || (remote.lastUpdated && remote.lastUpdated > local.lastUpdated)) {
                console.log('Syncing page config from network');
                pageConfigService.saveConfig(remote);
                set(remote);
            }
        }
    }
};
