import { writable } from 'svelte/store';
import { settingsService } from '$lib/services/settingsService';
import { userRelayService } from '$lib/services/userRelayService';
import { ok, fail } from '$lib/domain/result';
import type { RelaySetting } from '$lib/infra/storage/dexieDb';
import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';

function createSettingsStore() {
    const { subscribe, set, update } = writable<RelaySetting[]>([]);

    return {
        subscribe,
        load: async () => {
            const pubkey = get(authStore).pubkey;
            if (!pubkey) {
                return;
            }

            const userList = userRelayService.getRelays(pubkey);
            if (userList.length > 0) {
                set(userList);
                return;
            }

            const res = await settingsService.getRelays();
            if (res.ok) {
                set(res.value);
            }
        },
        save: async (relays: RelaySetting[]) => {
            const pubkey = get(authStore).pubkey;
            if (!pubkey) {
                return fail({ message: 'Not authenticated' });
            }
            const res = userRelayService.saveRelays(pubkey, relays);
            if (res.ok) {
                set(relays);
            }
            return res;
        }
    };
}

export const settingsStore = createSettingsStore();
