import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { signerService } from './signerService';
import { fail, type Result } from '$lib/domain/result';
import type { NostrEvent } from 'nostr-tools';

export const longFormService = {
    async fetchMyLongForms(): Promise<Result<NostrEvent[]>> {
        const pubkeyRes = await signerService.getPublicKey();
        if (!pubkeyRes.ok) return fail(pubkeyRes.error);

        return subscriptions.fetchDiscoveryChapters([pubkeyRes.value], 0);
    }
};
