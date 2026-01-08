import { SimplePool, type NostrEvent, type EventTemplate } from 'nostr-tools';
import { signerService } from './signerService';
import { settingsService } from './settingsService';
import { mediaService, dataUrlToBlob } from './mediaService';
import { bookService } from './bookService';
import { bookRepo } from '$lib/infra/storage/bookRepo';
import { chapterRepo } from '$lib/infra/storage/chapterRepo';
import { ok, fail, type Result } from '$lib/domain/result';
import type { LocalBook, LocalChapterDraft } from '$lib/domain/types';
import { bookFingerprint, chapterFingerprint } from '$lib/utils/publicationFingerprint';
import { syncStatusStore } from '$lib/state/syncStatusStore';

export interface PublishResult {
    relays: Record<string, boolean>; // url -> success
    event: NostrEvent;
}

export const publisherService = {
    async publishBook(book: LocalBook, chapters: LocalChapterDraft[]): Promise<Result<PublishResult[]>> {
        const pubkeyRes = await signerService.getPublicKey();
        if (!pubkeyRes.ok) return fail(pubkeyRes.error);
        const pubkey = pubkeyRes.value;

        const relaysRes = await settingsService.getRelays();
        if (!relaysRes.ok) return fail(relaysRes.error);
        
        const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);
        if (relays.length === 0) return fail({ message: 'No active relays configured' });

        if (book.cover && book.cover.startsWith('data:')) {
            const blob = dataUrlToBlob(book.cover);
            const uploadRes = await mediaService.uploadCover(blob);
            if (!uploadRes.ok) return fail(uploadRes.error);
            book.cover = uploadRes.value;
            await bookService.updateBook(book);
        }

        const imageCache = new Map<string, string>();
        const pool = new SimplePool();
        const results: PublishResult[] = [];

        try {
            // 1. Publish Chapters
            for (const chapter of chapters) {
                const processed = await prepareChapterForPublish(chapter, imageCache);
                if (!processed.ok) {
                    pool.close(relays);
                    return fail(processed.error);
                }

                const chapterHash = await chapterFingerprint(chapter, processed.value);
                if (chapter.publishedHash && chapter.publishedHash === chapterHash) {
                    continue;
                }

                const chapterTags = [
                    ['d', chapter.d],
                    ['title', chapter.title],
                    ['published_at', Math.floor(Date.now() / 1000).toString()],
                    ['book', book.d]
                ];

                const chapterTemplate: EventTemplate = {
                    kind: 30023,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: chapterTags,
                    content: processed.value
                };

                const signedChapterRes = await signerService.signEvent(chapterTemplate);
                if (!signedChapterRes.ok) {
                    pool.close(relays);
                    return fail(signedChapterRes.error);
                }
                const signedChapter = signedChapterRes.value;

                const chapterPubResult = await this._publishToRelays(pool, relays, signedChapter);
                results.push(chapterPubResult);

                chapter.publishedHash = chapterHash;
                await chapterRepo.save(chapter);
            }

            // 2. Publish Book TOC
            const bookHash = await bookFingerprint(book);
            const shouldPublishBook = !book.publishedHash || bookHash !== book.publishedHash;
            if (!shouldPublishBook) {
                return ok(results);
            }

            const bookTags = [
                ['d', book.d],
                ['title', book.title],
                ['t', 'binder-book'], // Marker for Binder compatibility
            ];
            if (book.summary) bookTags.push(['summary', book.summary]);
            chapters.forEach((c, index) => {
                bookTags.push(['a', `30023:${pubkey}:${c.d}`, String(index)]);
            });
            if (book.cover) {
                bookTags.push(['cover', book.cover]);
            }
            const authorTags = Array.from(new Set([pubkey, ...(book.coAuthors ?? [])])).filter(Boolean);
            authorTags.forEach(author => {
                bookTags.push(['p', author]);
            });
            const topicTags = Array.from(new Set(book.topics ?? [])).filter(Boolean);
            topicTags.forEach(topic => {
                bookTags.push(['t', topic]);
            });

            const bookTemplate: EventTemplate = {
                kind: 30003,
                created_at: Math.floor(Date.now() / 1000),
                tags: bookTags,
                content: book.summary || ''
            };

            const signedBookRes = await signerService.signEvent(bookTemplate);
            if (!signedBookRes.ok) {
                pool.close(relays);
                return fail(signedBookRes.error);
            }
            const signedBook = signedBookRes.value;

            const bookPubResult = await this._publishToRelays(pool, relays, signedBook);
            results.push(bookPubResult);

            book.publishedHash = bookHash;
            await bookRepo.save(book);
            syncStatusStore.markSynced(book.id);

            return ok(results);

        } catch (e) {
            return fail({ message: 'Publishing failed', cause: e });
        } finally {
            // In a real app we might keep pool open, but for this operation we can close it or let it persist. 
            // SimplePool manages connections. Explicit close might be safer for cleanup.
            // But waiting for all pubs to finish is done in _publishToRelays.
            pool.close(relays);
        }
    },

    async _publishToRelays(pool: SimplePool, relays: string[], event: NostrEvent): Promise<PublishResult> {
        const result: PublishResult = {
            relays: {},
            event
        };

        await Promise.allSettled(relays.map(async (relay) => {
            try {
                await pool.publish([relay], event);
                result.relays[relay] = true;
            } catch (e) {
                result.relays[relay] = false;
            }
        }));

        return result;
    }
};

async function prepareChapterForPublish(chapter: LocalChapterDraft, cache: Map<string, string>): Promise<Result<string>> {
    return replaceLocalImageLinks(chapter.contentMd, cache);
}

async function replaceLocalImageLinks(content: string, cache: Map<string, string>): Promise<Result<string>> {
    const regex = /!\[[^\]]*\]\((data:[^)]+)\)/g;
    const matches: { start: number; end: number; full: string; url: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content))) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        matches.push({
            start,
            end,
            full: match[0],
            url: match[1]
        });
    }

    if (matches.length === 0) {
        return ok(content);
    }

    let lastIndex = 0;
    let rewritten = '';

    for (const entry of matches) {
        const upload = await uploadLocalImage(entry.url, cache);
        if (!upload.ok) {
            return fail(upload.error);
        }

        rewritten += content.slice(lastIndex, entry.start);
        const replaced = entry.full.replace(entry.url, upload.value);
        rewritten += replaced;
        lastIndex = entry.end;
    }

    rewritten += content.slice(lastIndex);
    return ok(rewritten);
}

async function uploadLocalImage(dataUrl: string, cache: Map<string, string>): Promise<Result<string>> {
    if (cache.has(dataUrl)) {
        return ok(cache.get(dataUrl)!);
    }

    const blob = dataUrlToBlob(dataUrl);
    const res = await mediaService.uploadImage(blob);
    if (!res.ok) {
        return res;
    }

    cache.set(dataUrl, res.value);
    return ok(res.value);
}
