import { nip44, SimplePool, type EventTemplate, type Filter, type NostrEvent } from 'nostr-tools';
import { ok, fail, type Result } from '$lib/domain/result';
import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';
import { libraryService } from './libraryService';
import { libraryRepo } from '$lib/infra/storage/libraryRepo';
import { settingsService } from './settingsService';
import { signerService } from './signerService';
import { pool, fetchEvents } from '$lib/infra/nostr/pool';
import { getScopedSyncKey, getConversationKey } from './syncKeyService';
import type { SavedBook, Shelf, ReadingProgress } from '$lib/domain/types';

const LIBRARY_SET_KIND = 30003;
const LIBRARY_SET_D = 'binder-library';
const STATE_KIND = 30078;
const STATE_D = 'binder-state';
const STATE_SCOPE = 'binder-state';
const SYNC_VERSION = 2;

interface StatePayload {
  version: number;
  timestamp: number;
  shelves: Shelf[];
  readingProgress: ReadingProgress[];
  bookShelves: Record<string, string[]>; // bookId -> shelfIds
}

async function buildStatePayload(): Promise<Result<StatePayload>> {
  const shelvesRes = await libraryService.getShelves();
  if (!shelvesRes.ok) return fail(shelvesRes.error);

  const booksRes = await libraryRepo.getSavedBooks();
  if (!booksRes.ok) return fail(booksRes.error);

  const progressRes = await libraryRepo.getAllProgress();
  if (!progressRes.ok) return fail(progressRes.error);

  const bookShelves: Record<string, string[]> = {};
  booksRes.value.forEach(b => {
      bookShelves[b.id] = b.shelves;
  });

  return ok({
    version: SYNC_VERSION,
    timestamp: Date.now(),
    shelves: shelvesRes.value,
    readingProgress: progressRes.value,
    bookShelves
  });
}

async function publishEvents(relays: string[], events: NostrEvent[]): Promise<void> {
    // We use the shared pool instance but need to handle publishing
    // SimplePool publish returns an array of promises (one per relay)
    await Promise.allSettled(events.flatMap(e => pool.publish(relays, e)));
}

export const librarySyncService = {
  async publishLibrarySnapshot(): Promise<Result<void>> {
    const auth = get(authStore);
    if (!auth.pubkey) return fail({ message: 'Not authenticated' });

    const relaysRes = await settingsService.getRelays();
    if (!relaysRes.ok) return fail(relaysRes.error);
    const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);
    if (relays.length === 0) return fail({ message: 'No relays configured for library sync' });

    // 1. Prepare Public Bookmark Set (Kind 30003)
    const booksRes = await libraryRepo.getSavedBooks();
    if (!booksRes.ok) return fail(booksRes.error);
    
    const publicTags = [
        ['d', LIBRARY_SET_D],
        ['t', 'binder-book'],
        ['title', 'Binder Library']
    ];
    
    booksRes.value.forEach(book => {
        // Construct 'a' tag: kind:pubkey:d
        // SavedBook.id is likely the 'a' tag value or we construct it
        // Assuming book.id might be just 'd' or full coord. 
        // SavedBook interface says: id, kind, pubkey, d.
        publicTags.push(['a', `${book.kind}:${book.pubkey}:${book.d}`]);
    });

    const publicTemplate: EventTemplate = {
        kind: LIBRARY_SET_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: publicTags,
        content: 'My saved books on Binder'
    };

    // 2. Prepare Private State (Kind 30078)
    const stateRes = await buildStatePayload();
    if (!stateRes.ok) return fail(stateRes.error);

    const keyRes = await getScopedSyncKey(STATE_SCOPE);
    if (!keyRes.ok) return fail(keyRes.error);
    
    const conversationKey = getConversationKey(keyRes.value);
    const encryptedState = nip44.encrypt(JSON.stringify(stateRes.value), conversationKey);

    const stateTemplate: EventTemplate = {
        kind: STATE_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', STATE_D]],
        content: encryptedState
    };

    // Sign both
    const signedPublic = await signerService.signEvent(publicTemplate);
    if (!signedPublic.ok) return fail(signedPublic.error);

    const signedState = await signerService.signEvent(stateTemplate);
    if (!signedState.ok) return fail(signedState.error);

    await publishEvents(relays, [signedPublic.value, signedState.value]);
    return ok(undefined);
  },

  async restoreLatestSnapshot(): Promise<Result<boolean>> {
    const auth = get(authStore);
    if (!auth.pubkey) return fail({ message: 'Not authenticated' });

    const relaysRes = await settingsService.getRelays();
    if (!relaysRes.ok) return fail(relaysRes.error);
    const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);

    if (relays.length === 0) return ok(false);

    // Fetch both events
    const results = await fetchEvents(relays, [
        {
            kinds: [LIBRARY_SET_KIND],
            authors: [auth.pubkey],
            '#d': [LIBRARY_SET_D],
            limit: 1
        },
        {
            kinds: [STATE_KIND],
            authors: [auth.pubkey],
            '#d': [STATE_D],
            limit: 1
        }
    ]);

    const publicEvent = results.find(e => e.kind === LIBRARY_SET_KIND);
    const stateEvent = results.find(e => e.kind === STATE_KIND);

    if (!publicEvent && !stateEvent) return ok(false);

    let bookShelves: Record<string, string[]> = {};
    
    // Process State first to get shelves mapping
    if (stateEvent) {
        try {
            const keyRes = await getScopedSyncKey(STATE_SCOPE);
            if (keyRes.ok) {
                const conversationKey = getConversationKey(keyRes.value);
                const decrypted = nip44.decrypt(stateEvent.content, conversationKey);
                const payload = JSON.parse(decrypted) as StatePayload;
                
                // Apply Shelves
                for (const shelf of payload.shelves) {
                    await libraryRepo.saveShelf(shelf);
                }
                
                // Apply Progress
                for (const progress of payload.readingProgress) {
                    await libraryRepo.saveProgress(progress);
                }
                
                bookShelves = payload.bookShelves || {};
            }
        } catch (e) {
            console.warn('Failed to restore private library state', e);
        }
    }

    // Process Public List
    if (publicEvent) {
        for (const tag of publicEvent.tags) {
            if (tag[0] === 'a') {
                const [kindStr, pubkey, d] = tag[1].split(':');
                if (!kindStr || !pubkey || !d) continue;

                const id = `${kindStr}:${pubkey}:${d}`;
                const shelves = bookShelves[id] || [];
                
                // We create a minimal SavedBook. 
                // Detailed metadata (title, etc) will be missing until fetched.
                // The UI should handle missing metadata gracefully or fetch it.
                const book: SavedBook = {
                    id,
                    kind: parseInt(kindStr),
                    pubkey,
                    d,
                    title: 'Loading...', // Placeholder
                    shelves,
                    addedAt: publicEvent.created_at * 1000
                };
                
                // Only save if not exists or force update? 
                // We shouldn't overwrite existing rich metadata with "Loading..."
                // So we check existence first.
                const existing = await libraryRepo.getSavedBook(id);
                if (!existing.ok || !existing.value) {
                    await libraryRepo.saveBook(book);
                } else {
                    // Update shelves only
                    const updated = { ...existing.value, shelves };
                    await libraryRepo.saveBook(updated);
                }
            }
        }
    }

    return ok(true);
  }
};
