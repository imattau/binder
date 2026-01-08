import { pool, getActiveRelays } from '$lib/infra/nostr/pool';
import { signerService } from './signerService';
import { ok, fail, type Result } from '$lib/domain/result';
import type { EventTemplate } from 'nostr-tools';

const REPORT_KIND = 50000;

async function publishEvent(template: EventTemplate): Promise<Result<void>> {
    const relays = await getActiveRelays();
    if (relays.length === 0) return fail({ message: 'No relays configured' });

    const signedRes = await signerService.signEvent(template);
    if (!signedRes.ok) return fail(signedRes.error);

    try {
        await Promise.any(relays.map(relay => pool.publish([relay], signedRes.value)));
        return ok(undefined);
    } catch (e) {
        return fail({ message: 'Failed to publish moderation event', cause: e });
    }
}

export const moderationService = {
    muteAuthor: (pubkey: string) => {
        const template: EventTemplate = {
            kind: 10000,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', pubkey]],
            content: `Mute ${pubkey}`
        };
        return publishEvent(template);
    },

    muteThread: (threadId: string, author?: string) => {
        const tags: EventTemplate['tags'] = [['e', threadId]];
        if (author) {
            tags.push(['p', author]);
        }
        const template: EventTemplate = {
            kind: 10001,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content: `Mute thread ${threadId}`
        };
        return publishEvent(template);
    },

    reportComment: (commentId: string, player: string, reason: string) => {
        const template: EventTemplate = {
            kind: REPORT_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['e', commentId],
                ['p', player],
                ['d', 'comment-report']
            ],
            content: reason
        };
        return publishEvent(template);
    }
};
