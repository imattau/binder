import { writable } from 'svelte/store';
import { healthService } from '$lib/services/healthService';
import type { HealthReport } from '$lib/domain/types';

function createHealthStore() {
    const { subscribe, set } = writable<HealthReport | null>(null);

    return {
        subscribe,
        refresh: async () => {
            const res = await healthService.getHealthReport();
            if (res.ok) {
                set(res.value);
            }
        }
    };
}

export const healthStore = createHealthStore();
