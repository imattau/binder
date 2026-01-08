import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { ok, fail, type Result } from '$lib/domain/result';
import type { FeedItem } from '$lib/domain/types';

export const tagService = {
    async getTagFeed(tag: string): Promise<Result<{ books: FeedItem[], chapters: FeedItem[] }>> {
        const [booksRes, chaptersRes] = await Promise.all([
            subscriptions.fetchByTag(tag, 30003),
            subscriptions.fetchByTag(tag, 30023)
        ]);

        if (!booksRes.ok && !chaptersRes.ok) return fail(booksRes.error || { message: 'Fetch failed' });

        return ok({
            books: (booksRes.ok ? booksRes.value : []).map(e => ({ event: e, type: 'book', reason: '#' + tag })),
            chapters: (chaptersRes.ok ? chaptersRes.value : []).map(e => ({ event: e, type: 'chapter', reason: '#' + tag }))
        });
    }
};
