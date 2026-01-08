import { writable } from 'svelte/store';
import { bookService } from '$lib/services/bookService';
import { chapterDraftService } from '$lib/services/chapterDraftService';
import { contentCacheService } from '$lib/services/contentCacheService';
import type { LocalBook, LocalChapterDraft } from '$lib/domain/types';

interface CurrentBookState {
    book: LocalBook | null;
    chapters: LocalChapterDraft[];
    loading: boolean;
}

function createCurrentBookStore() {
    const { subscribe, set, update } = writable<CurrentBookState>({
        book: null,
        chapters: [],
        loading: false
    });

    return {
        subscribe,
        reset: () => set({ book: null, chapters: [], loading: false }),
        load: async (bookId: string) => {
            if (!bookId) return;
            update(s => ({ ...s, loading: true }));
            
            // Check if ID is a coordinate (remote)
            if (bookId.includes(':')) {
                const parts = bookId.split(':');
                if (parts.length >= 3) {
                    const [kind, pubkey, d] = parts;
                    const res = await contentCacheService.getBook(pubkey, d, 'prefer-offline');
                    
                    if (res.ok) {
                        const event = res.value;
                        const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled';
                        const summary = event.tags.find(t => t[0] === 'summary')?.[1];
                        const topics = event.tags.filter(t => t[0] === 't').map(t => t[1]).filter((value): value is string => Boolean(value));
                        const coAuthors = event.tags
                            .filter(t => t[0] === 'p')
                            .map(t => t[1])
                            .filter((value, index, list) => typeof value === 'string' && value !== event.pubkey && list.indexOf(value) === index);
                        
                        // Security: Enforce Same-Author Policy
                        // Only load chapters that belong to the Book's author.
                        // This prevents malicious books from including chapters they don't own.
                        const bookPubkey = event.pubkey;
                        
                        const chapterCoords = event.tags
                            .filter(t => t[0] === 'a' && t[1].startsWith('30023:'))
                            .map(t => t[1])
                            .filter(coord => {
                                const [k, pk, cd] = coord.split(':');
                                return pk === bookPubkey;
                            });

                        // Map to LocalChapterDraft structure for UI compatibility
                        const mappedChapters: LocalChapterDraft[] = chapterCoords.map((coord, i) => {
                            const [k, pk, cd] = coord.split(':');
                            return {
                                id: coord,
                                d: cd,
                                bookId: bookId,
                                title: `Chapter ${i + 1}`, // Placeholder until loaded
                                contentMd: '',
                                status: 'ready',
                                createdAt: 0,
                                updatedAt: 0
                            };
                        });
                        
                        // Async fetch chapter details
                        Promise.all(chapterCoords.map(async (c) => {
                            const [k, pk, cd] = c.split(':');
                            const chRes = await contentCacheService.getChapter(pk, cd, 'prefer-offline');
                            if (chRes.ok) {
                                return {
                                    id: c,
                                    d: cd,
                                    bookId: bookId,
                                    title: chRes.value.tags.find(t => t[0] === 'title')?.[1] || 'Untitled',
                                    contentMd: chRes.value.content,
                                    status: 'ready',
                                    createdAt: chRes.value.created_at,
                                    updatedAt: chRes.value.created_at
                                } as LocalChapterDraft;
                            }
                            return null;
                        })).then(loaded => {
                            const valid = loaded.filter((x): x is LocalChapterDraft => !!x);
                            if (valid.length > 0) {
                                update(s => ({ ...s, chapters: valid }));
                            }
                        });

                        set({ 
                            book: {
                                id: bookId,
                                d,
                                title,
                                summary,
                                tags: [],
                                topics,
                                coAuthors,
                                chapterOrder: chapterCoords,
                                createdAt: event.created_at,
                                updatedAt: event.created_at,
                                publishedHash: undefined
                            }, 
                            chapters: mappedChapters, 
                            loading: false 
                        });
                        return;
                    }
                }
            }

            // Local Fallback
            const bookRes = await bookService.getBook(bookId);
            if (bookRes.ok && bookRes.value) {
                const chaptersRes = await chapterDraftService.getChapters(bookId);
                const chapters = chaptersRes.ok ? chaptersRes.value : [];
                
                const orderMap = new Map(bookRes.value.chapterOrder.map((id, index) => [id, index]));
                chapters.sort((a, b) => {
                    const indexA = orderMap.get(a.id) ?? Infinity;
                    const indexB = orderMap.get(b.id) ?? Infinity;
                    return indexA - indexB;
                });

                set({ 
                    book: {
                        ...bookRes.value,
                        topics: bookRes.value.topics ?? [],
                        coAuthors: bookRes.value.coAuthors ?? []
                    },
                    chapters,
                    loading: false 
                });
            } else {
                set({ book: null, chapters: [], loading: false });
            }
        },
        refreshChapters: async (bookId: string) => {
             const chaptersRes = await chapterDraftService.getChapters(bookId);
             if (chaptersRes.ok) {
                 update(s => {
                     if (!s.book) return s;
                     const orderMap = new Map(s.book.chapterOrder.map((id, index) => [id, index]));
                     const chapters = chaptersRes.value;
                     chapters.sort((a, b) => {
                        const indexA = orderMap.get(a.id) ?? Infinity;
                        const indexB = orderMap.get(b.id) ?? Infinity;
                        return indexA - indexB;
                     });
                     return { ...s, chapters };
                 });
             }
        }
    };
}

export const currentBookStore = createCurrentBookStore();
