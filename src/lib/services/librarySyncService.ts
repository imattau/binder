import { nip44, SimplePool, type EventTemplate, type Filter, type NostrEvent } from 'nostr-tools';
import { ok, fail, type Result } from '$lib/domain/result';
import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';
import { libraryService } from './libraryService';
import { libraryRepo } from '$lib/infra/storage/libraryRepo';
import { settingsService } from './settingsService';
import { signerService } from './signerService';
import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { getScopedSyncKey, getConversationKey } from './syncKeyService';
import type { SavedBook, Shelf, ReadingProgress } from '$lib/domain/types';

const LIBRARY_KIND = 10003;
const LIBRARY_D_PREFIX = 'library-shelves';
const LIBRARY_SYNC_TAG = 'library-sync';
const LIBRARY_KEY_TAG = 'library-sync-key';
const LIBRARY_VERSION = 1;
const LIBRARY_SCOPE = 'library';

let lastLibraryEvent = '';

interface LibraryPayload {
  version: number;
  timestamp: number;
  shelves: Shelf[];
  books: SavedBook[];
  readingProgress: ReadingProgress[];
}

async function buildPayload(): Promise<Result<LibraryPayload>> {
  const shelvesRes = await libraryService.getShelves();
  if (!shelvesRes.ok) return fail(shelvesRes.error);

  const booksRes = await libraryRepo.getSavedBooks();
  if (!booksRes.ok) return fail(booksRes.error);

  const progressRes = await libraryRepo.getAllProgress();
  if (!progressRes.ok) return fail(progressRes.error);

  return ok({
    version: LIBRARY_VERSION,
    timestamp: Date.now(),
    shelves: shelvesRes.value,
    books: booksRes.value,
    readingProgress: progressRes.value
  });
}

async function publishEvent(relays: string[], event: NostrEvent): Promise<void> {
  const pool = new SimplePool();
  await Promise.allSettled(relays.map(async (relay) => {
    try {
      await pool.publish([relay], event);
    } catch (error) {
      console.warn('Library sync publish failed on relay', relay, error);
    }
  }));
  pool.close(relays);
}

async function applySnapshot(payload: LibraryPayload): Promise<void> {
  for (const shelf of payload.shelves) {
    await libraryRepo.saveShelf(shelf);
  }

  for (const book of payload.books) {
    await libraryRepo.saveBook(book);
  }

  for (const progress of payload.readingProgress) {
    await libraryRepo.saveProgress(progress);
  }
}

export const librarySyncService = {
  async publishLibrarySnapshot(): Promise<Result<void>> {
    const auth = get(authStore);
    if (!auth.pubkey) return fail({ message: 'Not authenticated' });

    const relaysRes = await settingsService.getRelays();
    if (!relaysRes.ok) return fail(relaysRes.error);
    const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);
    if (relays.length === 0) return fail({ message: 'No relays configured for library sync' });

    const payloadRes = await buildPayload();
    if (!payloadRes.ok) return fail(payloadRes.error);

    const keyRes = await getScopedSyncKey(LIBRARY_SCOPE);
    if (!keyRes.ok) return fail(keyRes.error);

    const conversationKey = getConversationKey(keyRes.value);
    const encrypted = nip44.encrypt(JSON.stringify(payloadRes.value), conversationKey);

    const template: EventTemplate = {
      kind: LIBRARY_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${LIBRARY_D_PREFIX}:${auth.pubkey}`],
        ['t', 'library'],
        [LIBRARY_SYNC_TAG, 'snapshot'],
        [LIBRARY_KEY_TAG, keyRes.value.pubKey],
        ['version', String(LIBRARY_VERSION)]
      ],
      content: encrypted
    };

    const signed = await signerService.signEvent(template);
    if (!signed.ok) return fail(signed.error);

    await publishEvent(relays, signed.value);
    return ok(undefined);
  },

  async restoreLatestSnapshot(): Promise<Result<boolean>> {
    const auth = get(authStore);
    if (!auth.pubkey) return fail({ message: 'Not authenticated' });

    const keyRes = await getScopedSyncKey(LIBRARY_SCOPE);
    if (!keyRes.ok) return fail<boolean>(keyRes.error);

    const filter = {
      kinds: [LIBRARY_KIND],
      authors: [auth.pubkey],
      '#d': [`${LIBRARY_D_PREFIX}:${auth.pubkey}`]
    } as Filter;
    (filter as Record<string, string[]>)['#' + LIBRARY_KEY_TAG] = [keyRes.value.pubKey];

    const eventsRes = await subscriptions.fetchFeed(filter, 1);
    if (!eventsRes.ok) return eventsRes;
    if (eventsRes.value.length === 0) return ok(false);

    const latest = eventsRes.value[0];
    if (latest.id === lastLibraryEvent) return ok(false);

    try {
      const conversationKey = getConversationKey(keyRes.value);
      const decrypted = nip44.decrypt(latest.content, conversationKey);
      const payload = JSON.parse(decrypted) as LibraryPayload;
      await applySnapshot(payload);
      lastLibraryEvent = latest.id;
      return ok(true);
    } catch (error) {
      return fail({ message: 'Failed to decrypt library snapshot', cause: error });
    }
  }
};
