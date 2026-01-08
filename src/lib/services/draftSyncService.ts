import { SimplePool, type Filter, type NostrEvent, type EventTemplate, nip44 } from 'nostr-tools';
import { ok, fail, type Result } from '$lib/domain/result';
import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';
import type { LocalBook, LocalChapterDraft, DraftSnapshot } from '$lib/domain/types';
import { bookRepo } from '$lib/infra/storage/bookRepo';
import { chapterRepo } from '$lib/infra/storage/chapterRepo';
import { snapshotRepo } from '$lib/infra/storage/snapshotRepo';
import { snapshotService } from './snapshotService';
import { settingsService } from './settingsService';
import { signerService } from './signerService';
import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { getScopedSyncKey, getConversationKey } from './syncKeyService';

const SYNC_KIND = 30078;
const SYNC_D_PREFIX = 'binder-book-snapshot';
const SNAPSHOT_D_PREFIX = 'binder-snapshots';
const SYNC_TAG = 'binder-sync';
const SYNC_KEY_TAG = 'binder-sync-key';
const SYNC_VERSION = 2;
const SYNC_SCOPE = 'binder-sync';

let lastSyncedEvent = '';

interface SnapshotPayload {
    version: number;
    timestamp: number;
    action: 'snapshot' | 'delete';
    book?: LocalBook;
    chapters?: LocalChapterDraft[];
}

interface HistoryPayload {
    chapterId: string;
    snapshots: DraftSnapshot[];
    version: number;
    timestamp: number;
}

async function loadBook(bookId: string): Promise<Result<LocalBook>> {
    const res = await bookRepo.get(bookId);
    if (!res.ok || !res.value) return fail({ message: 'Book not found for sync' });
    return ok(res.value);
}

async function loadChapters(bookId: string): Promise<Result<LocalChapterDraft[]>> {
    const res = await chapterRepo.getAllForBook(bookId);
    if (!res.ok) return res;
    return ok(res.value);
}

async function publishSnapshot(book: LocalBook, chapters: LocalChapterDraft[]): Promise<Result<void>> {
    const payload: SnapshotPayload = {
        version: SYNC_VERSION,
        timestamp: Date.now(),
        action: 'snapshot',
        book,
        chapters
    };

    return publishPayload(payload);
}

async function publishDeletion(book: LocalBook): Promise<Result<void>> {
    const payload: SnapshotPayload = {
        version: SYNC_VERSION,
        timestamp: Date.now(),
        action: 'delete',
        book
    };

    return publishPayload(payload);
}

async function publishPayload(payload: SnapshotPayload): Promise<Result<void>> {
    const relaysRes = await settingsService.getRelays();
    if (!relaysRes.ok) return fail(relaysRes.error);
    const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);
    if (relays.length === 0) return fail({ message: 'No relays configured for draft sync' });

    const keyRes = await getScopedSyncKey(SYNC_SCOPE);
    if (!keyRes.ok) return fail(keyRes.error);
    const conversationKey = getConversationKey(keyRes.value);
    let encrypted: string;
    try {
        encrypted = nip44.encrypt(JSON.stringify(payload), conversationKey);
    } catch (e: any) {
        console.error('Draft sync encryption failed', e);
        return fail({
            message:
                e?.message?.includes('invalid plaintext size')
                    ? 'Draft snapshot too large to encrypt'
                    : 'Failed to encrypt draft snapshot',
            cause: e
        });
    }

    const template: EventTemplate = {
        kind: SYNC_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', `${SYNC_D_PREFIX}:${payload.book?.d ?? ''}`],
            [SYNC_TAG, 'draft-snapshot'],
            [SYNC_KEY_TAG, keyRes.value.pubKey],
            ['version', String(SYNC_VERSION)],
            ['action', payload.action]
        ],
        content: encrypted
    };

    if (!payload.book) {
        return fail({ message: 'Snapshot payload must include book info' });
    }

    const signedRes = await signerService.signEvent(template);
    if (!signedRes.ok) return fail(signedRes.error);

    await publishEvent(relays, signedRes.value);
    return ok(undefined);
}

async function publishEvent(relays: string[], event: NostrEvent): Promise<void> {
    const pool = new SimplePool();
    await Promise.all(relays.map(async (relay) => {
        const publishPromises = pool.publish([relay], event);
        const results = await Promise.allSettled(publishPromises);
        results.forEach((result) => {
            if (result.status === 'rejected') {
                console.warn('Draft sync publish failed for relay', relay, result.reason);
            }
        });
    }));
    pool.close(relays);
}

async function removeBookLocally(bookId: string): Promise<void> {
    await chapterRepo.deleteAllForBook(bookId);
    await bookRepo.delete(bookId);
}

export const draftSyncService = {
    async syncBook(bookId: string): Promise<Result<void>> {
        const auth = get(authStore);
        if (!auth.pubkey) return fail({ message: 'Not authenticated' });

        const bookRes = await loadBook(bookId);
        if (!bookRes.ok) return bookRes;

        const chaptersRes = await loadChapters(bookId);
        if (!chaptersRes.ok) return chaptersRes;

        return publishSnapshot(bookRes.value, chaptersRes.value);
    },

    async restoreLatestSnapshot(): Promise<Result<void>> {
        const auth = get(authStore);
        if (!auth.pubkey) return fail({ message: 'Not authenticated' });

        const keyRes = await getScopedSyncKey(SYNC_SCOPE);
        if (!keyRes.ok) return keyRes;

        const filter = {
            kinds: [SYNC_KIND, 40012], // Check both for backward compatibility
            authors: [auth.pubkey],
            limit: 10
        } as Filter;
        (filter as Record<string, string[]>)['#' + SYNC_KEY_TAG] = [keyRes.value.pubKey];

        const eventsRes = await subscriptions.fetchFeed(filter, 10);
        if (!eventsRes.ok) return eventsRes;
        if (eventsRes.value.length === 0) return ok(undefined);

        // Sort by created_at desc to get the latest across both kinds
        const sorted = eventsRes.value.sort((a, b) => b.created_at - a.created_at);
        const latest = sorted[0];
        if (latest.id === lastSyncedEvent) return ok(undefined);

        try {
            const conversationKey = getConversationKey(keyRes.value);
            const decrypted = nip44.decrypt(latest.content, conversationKey);
            const payload = JSON.parse(decrypted) as SnapshotPayload;
            await applySnapshot(payload);
            lastSyncedEvent = latest.id;
            return ok(undefined);
        } catch (e: any) {
            return fail({ message: 'Failed to decrypt draft snapshot', cause: e });
        }
    },

    async notifyBookDeletion(book: LocalBook): Promise<Result<void>> {
        return publishDeletion(book);
    },

    async publishChapterSnapshots(chapterId: string): Promise<Result<void>> {
        const snapshotsRes = await snapshotService.getSnapshots(chapterId);
        if (!snapshotsRes.ok || snapshotsRes.value.length === 0) return ok(undefined);

        const payload: HistoryPayload = {
            chapterId,
            snapshots: snapshotsRes.value,
            version: SYNC_VERSION,
            timestamp: Date.now()
        };

        const relaysRes = await settingsService.getRelays();
        if (!relaysRes.ok) return fail(relaysRes.error);
        const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);
        
        const keyRes = await getScopedSyncKey(SYNC_SCOPE);
        if (!keyRes.ok) return fail(keyRes.error);
        const conversationKey = getConversationKey(keyRes.value);
        const encrypted = nip44.encrypt(JSON.stringify(payload), conversationKey);

        const template: EventTemplate = {
            kind: SYNC_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['d', `${SNAPSHOT_D_PREFIX}:${chapterId}`],
                [SYNC_TAG, 'history-snapshot'],
                [SYNC_KEY_TAG, keyRes.value.pubKey],
                ['version', String(SYNC_VERSION)]
            ],
            content: encrypted
        };

        const signedRes = await signerService.signEvent(template);
        if (!signedRes.ok) return fail(signedRes.error);

        await publishEvent(relays, signedRes.value);
        return ok(undefined);
    },

    async restoreChapterSnapshots(chapterId: string): Promise<Result<void>> {
        const auth = get(authStore);
        if (!auth.pubkey) return fail({ message: 'Not authenticated' });

        const keyRes = await getScopedSyncKey(SYNC_SCOPE);
        if (!keyRes.ok) return keyRes;

        const filter = {
            kinds: [SYNC_KIND],
            authors: [auth.pubkey],
            '#d': [`${SNAPSHOT_D_PREFIX}:${chapterId}`],
            limit: 1
        } as Filter;
        (filter as Record<string, string[]>)['#' + SYNC_KEY_TAG] = [keyRes.value.pubKey];

        const eventsRes = await subscriptions.fetchFeed(filter, 1);
        if (!eventsRes.ok || eventsRes.value.length === 0) return ok(undefined);

        const event = eventsRes.value[0];
        try {
            const conversationKey = getConversationKey(keyRes.value);
            const decrypted = nip44.decrypt(event.content, conversationKey);
            const payload = JSON.parse(decrypted) as HistoryPayload;
            
            for (const snap of payload.snapshots) {
                // Ensure we don't overwrite newer if ID collision? 
                // Snapshots are immutable usually.
                // We just save.
                await snapshotRepo.save(snap);
            }
        } catch (e: any) {
             return fail({ message: 'Failed to restore history', cause: e });
        }
        return ok(undefined);
    }
};

async function applySnapshot(payload: SnapshotPayload): Promise<void> {
    if (payload.action === 'delete' && payload.book) {
        await removeBookLocally(payload.book.id);
        return;
    }

    if (!payload.book) {
        return;
    }

    const bookRes = await bookRepo.get(payload.book.id);
    if (!bookRes.ok || !bookRes.value || payload.book.updatedAt > bookRes.value.updatedAt) {
        await bookRepo.save(payload.book);
    }

    const chapters = payload.chapters ?? [];
    for (const chapter of chapters) {
        const existing = await chapterRepo.get(chapter.id);
        if (!existing.ok || !existing.value || chapter.updatedAt > existing.value.updatedAt) {
            await chapterRepo.save(chapter);
        }
    }
}
