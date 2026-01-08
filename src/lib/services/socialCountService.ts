import { reactionService } from './reactionService';
import { boostService } from './boostService';
import { replyService } from './replyService';
import { zapService } from './zapService';
import type { Result } from '$lib/domain/result';

export interface SocialCounts {
    likes: number;
    comments: number;
    boosts: number;
    zaps: number;
}

export async function getSocialCounts(coords: { kind: number; pubkey: string; d: string }): Promise<Result<SocialCounts>> {
    const [reactions, boosts, replies, zaps] = await Promise.all([
        reactionService.getReactions(coords),
        boostService.getBoosts(coords),
        replyService.getReplies(coords),
        zapService.getZapReceipts(coords)
    ]);

    if (!reactions.ok && !boosts.ok && !replies.ok && !zaps.ok) {
        return { ok: false, error: { message: 'Failed to load engagement stats' } };
    }

    return { ok: true, value: {
        likes: reactions.ok ? reactions.value.length : 0,
        comments: replies.ok ? replies.value.length : 0,
        boosts: boosts.ok ? boosts.value.length : 0,
        zaps: zaps.ok ? zaps.value.length : 0
    }};
}
