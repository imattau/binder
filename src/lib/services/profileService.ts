import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { ok, fail, type Result } from '$lib/domain/result';
import type { AuthorProfile } from '$lib/domain/types';

export const profileService = {
    async loadProfile(pubkey: string): Promise<Result<Partial<AuthorProfile>>> {
        const res = await subscriptions.fetchMetadata([pubkey]);
        if (!res.ok) {
            return fail(res.error);
        }

        const event = res.value[0];
        if (!event) {
            return ok({});
        }

        try {
            const data = JSON.parse(event.content || '{}');
            const profile: Partial<AuthorProfile> = {
                name: data.name,
                picture: data.picture,
                displayName: data.displayName,
                about: data.about,
                nip05: data.nip05
            };
            return ok(profile);
        } catch (e: any) {
            return fail({ message: 'Failed to parse profile metadata', cause: e });
        }
    }
};
