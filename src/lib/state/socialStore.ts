import { writable } from 'svelte/store';
import { reactionService } from '$lib/services/reactionService';
import { boostService } from '$lib/services/boostService';
import { replyService } from '$lib/services/replyService';
import { zapService } from '$lib/services/zapService';
import type { NostrEvent } from 'nostr-tools';
import type { Result } from '$lib/domain/result';

export interface SocialState {
    reactions: NostrEvent[];
    boosts: NostrEvent[];
    replies: NostrEvent[];
    zaps: NostrEvent[];
    loading: boolean;
}

export function createSocialStore() {
    const { subscribe, set, update } = writable<SocialState>({
        reactions: [],
        boosts: [],
        replies: [],
        zaps: [],
        loading: false
    });

    async function loadStats(coords: { kind: number, pubkey: string, d: string }) {
        update(s => ({ ...s, loading: true }));
                
        const [reactions, boosts, replies, zaps] = await Promise.all([
            reactionService.getReactions(coords),
            boostService.getBoosts(coords),
            replyService.getReplies(coords),
            zapService.getZapReceipts(coords)
        ]);

        set({
            reactions: reactions.ok ? reactions.value : [],
            boosts: boosts.ok ? boosts.value : [],
            replies: replies.ok ? replies.value : [],
            zaps: zaps.ok ? zaps.value : [],
            loading: false
        });
    }

    return {
        subscribe,
        load: async (coords: { kind: number, pubkey: string, d: string }) => {
            await loadStats(coords);
        },
        react: async (coords: { kind: number, pubkey: string, d: string }): Promise<Result<void>> => {
            const res = await reactionService.react(coords);
            if (res.ok) {
                await loadStats(coords);
            }
            return res;
        },
        boost: async (coords: { kind: number, pubkey: string, d: string }): Promise<Result<void>> => {
            const res = await boostService.boost(coords);
            if (res.ok) {
                await loadStats(coords);
            }
            return res;
        },
        reply: async (coords: { kind: number, pubkey: string, d: string }, content: string): Promise<Result<void>> => {
            const res = await replyService.reply(coords, content);
            if (res.ok) {
                await loadStats(coords);
            }
            return res;
        },
        requestZap: async (pubkey: string): Promise<Result<string>> => {
            return zapService.requestZap(pubkey);
        }
    };
}
