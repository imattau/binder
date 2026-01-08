import { pool, getActiveRelays, fetchEvents } from '$lib/infra/nostr/pool';
import { signerService } from './signerService';
import { ok, fail, type Result } from '$lib/domain/result';
import type { EventTemplate, NostrEvent } from 'nostr-tools';

export const replyService = {
    async getReplies(eventCoords: { kind: number, pubkey: string, d: string }): Promise<Result<NostrEvent[]>> {
        const relays = await getActiveRelays();
        if (relays.length === 0) return ok([]);

        const tag = `${eventCoords.kind}:${eventCoords.pubkey}:${eventCoords.d}`;
        
        try {
            const events = await fetchEvents(relays, [{
                kinds: [1],
                '#a': [tag]
            }]);
            return ok(events);
        } catch (e) {
             return fail({ message: 'Failed to fetch replies', cause: e });
        }
    },

    async reply(eventCoords: { kind: number, pubkey: string, d: string }, content: string): Promise<Result<void>> {
        const relays = await getActiveRelays();
        if (relays.length === 0) return fail({ message: 'No active relays' });

        const tag = `${eventCoords.kind}:${eventCoords.pubkey}:${eventCoords.d}`;
        
        const template: EventTemplate = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['a', tag, '', 'root'], // Root marker
                ['p', eventCoords.pubkey]
            ],
            content
        };

        const signedRes = await signerService.signEvent(template);
        if (!signedRes.ok) return fail(signedRes.error);
        
        try {
            await Promise.any(relays.map(r => pool.publish([r], signedRes.value)));
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to publish reply', cause: e });
        }
    }
};
