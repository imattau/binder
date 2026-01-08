import { writable } from 'svelte/store';
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
    },
    updateConfig: (partial: Partial<PageConfig>) => {
        update(current => {
            const next = { ...current, ...partial };
            pageConfigService.saveConfig(next);
            return next;
        });
    }
};
