import type { AuthorProfile } from '$lib/domain/types';
import { profileService } from './profileService';

const profileCache = new Map<string, AuthorProfile>();

export const commentMetaService = {
    async loadProfiles(pubkeys: string[]): Promise<Record<string, AuthorProfile>> {
        const promises: Promise<void>[] = [];

        pubkeys.forEach((pubkey) => {
            if (profileCache.has(pubkey)) return;
            promises.push(
                profileService.loadProfile(pubkey).then((res) => {
                    if (res.ok && Object.keys(res.value).length > 0) {
                        profileCache.set(pubkey, { pubkey, ...res.value });
                    }
                })
            );
        });

        await Promise.all(promises);
        const result: Record<string, AuthorProfile> = {};
        pubkeys.forEach((pubkey) => {
            const profile = profileCache.get(pubkey);
            if (profile) result[pubkey] = profile;
        });
        return result;
    },
    getCachedProfile(pubkey: string): AuthorProfile | undefined {
        return profileCache.get(pubkey);
    }
};
