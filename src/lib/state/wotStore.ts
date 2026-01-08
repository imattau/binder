import { writable } from 'svelte/store';
import { wotService, type WoTState } from '$lib/services/wotService';

const initialState: WoTState = {
    follows: new Set(),
    mutes: new Set(),
    loaded: false
};

function createWoTStore() {
    const { subscribe, set, update } = writable<WoTState>(initialState);

    return {
        subscribe,
        load: async () => {
            const res = await wotService.getUserWoT();
            if (res.ok) {
                set(res.value);
            }
        },
        reset: () => set(initialState)
        ,
        addMute: (pubkey: string) => {
            update(s => {
                const mutes = new Set(s.mutes);
                mutes.add(pubkey);
                return { ...s, mutes };
            });
        }
    };
}

export const wotStore = createWoTStore();
