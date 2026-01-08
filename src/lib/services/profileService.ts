import { ok, fail, type Result } from '$lib/domain/result';
import type { AuthorProfile } from '$lib/domain/types';
import { ndk, connectNDK } from '$lib/infra/nostr/ndk';

export const profileService = {
    async loadProfile(pubkey: string): Promise<Result<Partial<AuthorProfile>>> {
        try {
            // Ensure NDK is connected
            await connectNDK();
            
            const user = ndk.getUser({ pubkey });
            await user.fetchProfile();

            if (!user.profile) {
                return ok({});
            }

            const profile: Partial<AuthorProfile> = {
                name: user.profile.name,
                picture: user.profile.image,
                displayName: user.profile.displayName,
                about: user.profile.about,
                nip05: user.profile.nip05
            };
            return ok(profile);
        } catch (e: any) {
            return fail({ message: 'Failed to load profile via NDK', cause: e });
        }
    }
};
