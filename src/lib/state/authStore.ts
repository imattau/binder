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

    const persist = (state: AuthState) => {
        if (typeof localStorage === 'undefined') {
            return;
        }
        const serialized = {
            pubkey: state.pubkey,
            signerType: state.signerType,
            nip46BunkerUrl: state.nip46BunkerUrl,
            isAdmin: state.isAdmin,
            profile: state.profile
        };
        localStorage.setItem('binder_auth', JSON.stringify(serialized));
    };

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
            persist(state);
        },
        logout: () => {
            console.log('[AuthStore] Logging out');
            set({ pubkey: null, signerType: null, isAdmin: false });
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('binder_auth');
            }
        },
        updateProfile: (profile: NonNullable<AuthState['profile']>) => {
            update(state => {
                const next = { ...state, profile: { ...state.profile, ...profile } };
                persist(next);
                return next;
            });
        },
        loadSession: () => {
            if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('binder_auth');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    const nextState: AuthState = {
                        pubkey: parsed.pubkey ?? null,
                        signerType: parsed.signerType ?? null,
                        nip46BunkerUrl: parsed.nip46BunkerUrl,
                        isAdmin: parsed.isAdmin ?? false,
                        profile: parsed.profile
                    };
                    set(nextState);
                    return nextState;
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
