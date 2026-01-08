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

const MAX_SOCIAL_STATS_CONCURRENCY = 3;

type Task<T> = {
    run: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
};

const queue: Task<Result<SocialCounts>>[] = [];
let running = 0;
const pendingRequests = new Map<string, Promise<Result<SocialCounts>>>();

function drainQueue() {
    if (running >= MAX_SOCIAL_STATS_CONCURRENCY) return;
    const task = queue.shift();
    if (!task) return;

    running++;
    task
        .run()
        .then((value) => task.resolve(value))
        .catch((reason) => task.reject(reason))
        .finally(() => {
            running--;
            drainQueue();
        });
}

function enqueueSocialStatsRequest(coords: { kind: number; pubkey: string; d: string }): Promise<Result<SocialCounts>> {
    return new Promise((resolve, reject) => {
        queue.push({
            run: () => fetchSocialCounts(coords),
            resolve,
            reject
        });
        drainQueue();
    });
}

async function fetchSocialCounts(coords: { kind: number; pubkey: string; d: string }): Promise<Result<SocialCounts>> {
    const [reactions, boosts, replies, zaps] = await Promise.all([
        reactionService.getReactions(coords),
        boostService.getBoosts(coords),
        replyService.getReplies(coords),
        zapService.getZapReceipts(coords)
    ]);

    if (!reactions.ok && !boosts.ok && !replies.ok && !zaps.ok) {
        return { ok: false, error: { message: 'Failed to load engagement stats' } };
    }

    return {
        ok: true,
        value: {
            likes: reactions.ok ? reactions.value.length : 0,
            comments: replies.ok ? replies.value.length : 0,
            boosts: boosts.ok ? boosts.value.length : 0,
            zaps: zaps.ok ? zaps.value.length : 0
        }
    };
}

export async function getSocialCounts(coords: { kind: number; pubkey: string; d: string }): Promise<Result<SocialCounts>> {
    const key = `${coords.kind}:${coords.pubkey}:${coords.d}`;
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key)!;
    }
    const promise = enqueueSocialStatsRequest(coords);
    pendingRequests.set(key, promise);
    try {
        return await promise;
    } finally {
        pendingRequests.delete(key);
    }
}
