import { writable } from 'svelte/store';
import type { NostrEvent } from 'nostr-tools';

export type SignerType = 'nip07' | 'nip46' | 'readonly' | null;

interface AuthState {
    pubkey: string | null;
    signerType: SignerType;
    nip46BunkerUrl?: string;
    nip46LocalKey?: string; // Secret key for NIP-46 local signer
    isAdmin: boolean;
    profile?: {
        name?: string;
        picture?: string;
    };
}

function createAuthStore() {
    const { subscribe, set, update } = writable<AuthState>({
        pubkey: null,
        signerType: null,
        isAdmin: false
    });

    return {
        subscribe,
        login: (pubkey: string, type: SignerType, bunkerUrl?: string, localKey?: string, isAdmin = false) => {
            console.log(`[AuthStore] Logging in as ${pubkey} via ${type}`);
            const state: AuthState = { 
                pubkey, 
                signerType: type, 
                nip46BunkerUrl: bunkerUrl,
                nip46LocalKey: localKey,
                isAdmin
            };
            set(state);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('binder_auth', JSON.stringify(state));
            }
        },
        logout: () => {
            console.log('[AuthStore] Logging out');
            set({ pubkey: null, signerType: null, isAdmin: false });
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('binder_auth');
            }
        },
        loadSession: () => {
            if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('binder_auth');
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        set({ ...parsed, isAdmin: parsed.isAdmin ?? false });
                        return parsed;
                    } catch (e) {
                        localStorage.removeItem('binder_auth');
                    }
                }
            }
            return null;
        }
    };
}

export const authStore = createAuthStore();
