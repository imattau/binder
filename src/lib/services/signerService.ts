import { nip07Adapter } from '$lib/infra/nostr/nip07Adapter';
import { ok, fail, type Result } from '$lib/domain/result';
import type { EventTemplate, NostrEvent } from 'nostr-tools';

export const signerService = {
    async getPublicKey(): Promise<Result<string>> {
        try {
            if (!nip07Adapter.detect()) {
                return fail({ message: 'No signer extension detected' });
            }
            const pubkey = await nip07Adapter.getPublicKey();
            return ok(pubkey);
        } catch (e) {
            return fail({ message: 'Failed to get public key', cause: e });
        }
    },

    async signEvent(template: EventTemplate): Promise<Result<NostrEvent>> {
        try {
            if (!nip07Adapter.detect()) {
                return fail({ message: 'No signer extension detected' });
            }
            const event = await nip07Adapter.signEvent(template);
            return ok(event);
        } catch (e) {
            return fail({ message: 'Failed to sign event', cause: e });
        }
    }
};
