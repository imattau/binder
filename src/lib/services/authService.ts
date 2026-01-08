import { authStore, type SignerType } from '$lib/state/authStore';
import { nip07Adapter } from '$lib/infra/nostr/nip07Adapter';
import { ndk, connectNDK } from '$lib/infra/nostr/ndk';
import { NDKNip46Signer, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
import { ok, fail, type Result } from '$lib/domain/result';
import { generateSecretKey } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';
import { writerBooksStore } from '$lib/state/writerBooksStore';
import { currentBookStore } from '$lib/state/currentBookStore';
import { currentChapterStore } from '$lib/state/currentChapterStore';
import { get } from 'svelte/store';
import { settingsService } from './settingsService';
import { draftSyncService } from './draftSyncService';
import { goto } from '$app/navigation';
import { initiateNostrConnectSession, createResilientNip46Signer } from './nostrConnectService';
import { ensureAdminAssignment } from './adminService';
import { profileService } from './profileService';

export const authService = {
    async loginWithNip07(): Promise<Result<string>> {
        try {
            if (!nip07Adapter.detect()) {
                return fail({ message: 'Nostr extension not found' });
            }
            const pubkey = await nip07Adapter.getPublicKey();
            const isAdmin = ensureAdminAssignment(pubkey);
            authStore.login(pubkey, 'nip07', undefined, undefined, isAdmin);
            const profileRes = await profileService.loadProfile(pubkey);
            if (profileRes.ok) {
                authStore.updateProfile(profileRes.value);
            }
            
            // Sync relays in background
            settingsService.syncRelaysFromNetwork(pubkey);
            void draftSyncService.restoreLatestSnapshot();
            
            return ok(pubkey);
        } catch (e: any) {
            return fail({ message: e.message || 'Login failed' });
        }
    },

    async loginWithNip46(bunkerUrl: string): Promise<Result<{ pubkey: string, signer: NDKNip46Signer }>> {
        try {
            await connectNDK();
            
            let localKey = get(authStore).nip46LocalKey;
            if (!localKey) {
                const sk = generateSecretKey();
                localKey = bytesToHex(sk);
            }
            
            const localSigner = new NDKPrivateKeySigner(localKey);
            
            const signer = createResilientNip46Signer(bunkerUrl, localSigner);
            
            // For manual bunkerUrl (could be NIP-05), we might still need blockUntilReady
            // but we'll wrap it in a timeout and RPC check
            const user = await Promise.race([
                signer.blockUntilReady(),
                new Promise<NDKUser>((_, reject) => setTimeout(() => reject(new Error('Connection Timeout')), 15000))
            ]);
            
            const pubkey = user.pubkey;
            const isAdmin = ensureAdminAssignment(pubkey);
            authStore.login(pubkey, 'nip46', bunkerUrl, localKey, isAdmin);
            const profileRes = await profileService.loadProfile(pubkey);
            if (profileRes.ok) {
                authStore.updateProfile(profileRes.value);
            }
            settingsService.syncRelaysFromNetwork(pubkey);
            void draftSyncService.restoreLatestSnapshot();

            return ok({ pubkey, signer });
        } catch (e: any) {
            return fail({ message: e.message || 'NIP-46 Login failed' });
        }
    },

    // --- Task 7: NIP-46 QR Code Flow ---

    async createNip46Connection(): Promise<Result<{ uri: string, waitForUser: () => Promise<string> }>> {
        try {
            const session = await initiateNostrConnectSession();
            const waitForUser = async (): Promise<string> => {
                const response = await session.waitForUser();
                const user = response.user;
                const bunkerUrl = `bunker://${response.remotePubkey}?relay=${session.relays[0]}`;
                const isAdmin = ensureAdminAssignment(user.pubkey);
                authStore.login(user.pubkey, 'nip46', bunkerUrl, session.localKey, isAdmin);
                const profileRes = await profileService.loadProfile(user.pubkey);
                if (profileRes.ok) {
                    authStore.updateProfile(profileRes.value);
                }
                void settingsService.syncRelaysFromNetwork(user.pubkey);
                void draftSyncService.restoreLatestSnapshot();
                return user.pubkey;
            };

            return ok({ uri: session.uri, waitForUser });
        } catch (e: any) {
            return fail({ message: 'Failed to initiate NIP-46 connection', cause: e });
        }
    },

    logout() {
        authStore.logout();
        writerBooksStore.reset();
        currentBookStore.reset();
        currentChapterStore.reset();
        void settingsService.resetRelaysToDefaults();
        goto('/discover');
    }
};
