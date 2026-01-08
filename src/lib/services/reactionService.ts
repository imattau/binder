import { pool, getActiveRelays } from '$lib/infra/nostr/pool';
import { signerService } from './signerService';
import { ok, fail, type Result } from '$lib/domain/result';
import type { EventTemplate, NostrEvent } from 'nostr-tools';

export const reactionService = {
    async getReactions(eventCoords: { kind: number, pubkey: string, d: string }): Promise<Result<NostrEvent[]>> {
        const relays = await getActiveRelays();
        if (relays.length === 0) return ok([]);

        const tag = `${eventCoords.kind}:${eventCoords.pubkey}:${eventCoords.d}`;
        
        try {
        const events = await pool.querySync(relays, {
            kinds: [7, 10002],
            '#a': [tag]
        });
            return ok(events);
        } catch (e) {
             return fail({ message: 'Failed to fetch reactions', cause: e });
        }
    },

    async react(eventCoords: { kind: number, pubkey: string, d: string }, content = '+'): Promise<Result<void>> {
        const relays = await getActiveRelays();
        if (relays.length === 0) return fail({ message: 'No active relays' });

        const tag = `${eventCoords.kind}:${eventCoords.pubkey}:${eventCoords.d}`;
        
        const template: EventTemplate = {
            kind: 7,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['a', tag], ['p', eventCoords.pubkey]],
            content
        };

        const signedRes = await signerService.signEvent(template);
        if (!signedRes.ok) return fail(signedRes.error);
        
        try {
            await Promise.any(relays.map(r => pool.publish([r], signedRes.value)));
            return ok(undefined);
        } catch (e) {
            return fail({ message: 'Failed to publish reaction', cause: e });
        }
    }
};
