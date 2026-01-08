import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { ok, type Result } from '$lib/domain/result';
import type { NostrEvent } from 'nostr-tools';

export function getBookTag(event: NostrEvent): string | null {
  return event.tags.find(t => t[0] === 'book')?.[1] || null;
}

export const annotationService = {
  async getAnnotationCounts(bookDs: string[]): Promise<Result<Record<string, number>>> {
    if (bookDs.length === 0) {
      return ok({});
    }
    const res = await subscriptions.fetchAnnotationsForBooks(bookDs);
    if (!res.ok) return res;

    const counts: Record<string, number> = {};
    for (const event of res.value) {
      const bookTag = getBookTag(event);
      if (!bookTag) continue;
      counts[bookTag] = (counts[bookTag] ?? 0) + 1;
    }

    return ok(counts);
  }
};
