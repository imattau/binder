import { writable } from 'svelte/store';
import { chapterDraftService } from '$lib/services/chapterDraftService';
import { snapshotService } from '$lib/services/snapshotService';
import { contentCacheService } from '$lib/services/contentCacheService';
import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';
import type { LocalChapterDraft, DraftSnapshot } from '$lib/domain/types';

interface CurrentChapterState {
    chapter: LocalChapterDraft | null;
    snapshots: DraftSnapshot[];
    loading: boolean;
    loadError?: string;
    isDirty: boolean;
}

function createCurrentChapterStore() {
    const { subscribe, set, update } = writable<CurrentChapterState>({
        chapter: null,
        snapshots: [],
        loading: false,
        loadError: undefined,
        isDirty: false
    });

    return {
        subscribe,
        set,
        update,
        reset: () => set({ chapter: null, snapshots: [], loading: false, loadError: undefined, isDirty: false }),
        load: async (chapterId: string) => {
            if (!chapterId) return;
            update(s => ({ ...s, loading: true, loadError: undefined }));
            
            // Check for Remote Coordinate
            let remoteError: string | undefined;
            if (chapterId.includes(':')) {
                const [kind, pubkey, d] = chapterId.split(':');
                const res = await contentCacheService.getChapter(pubkey, d, 'prefer-offline');

                if (res.ok) {
                    const event = res.value;
                    const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled';
                    const bookId = event.tags.find(t => t[0] === 'book')?.[1] || ''; // This is likely just 'd', not full coord
                    
                    set({
                        loadError: undefined,
                        chapter: {
                            id: chapterId,
                            d,
                            bookId,
                            title,
                            contentMd: event.content,
                            status: 'ready',
                            createdAt: event.created_at,
                            updatedAt: event.created_at,
                            pubkey: event.pubkey
                        },
                        snapshots: [], // No snapshots for remote
                        loading: false,
                        isDirty: false
                    });
                    return;
                }
                remoteError = res.error?.message;
            }

            // Local Fallback
            const res = await chapterDraftService.getChapter(chapterId);
            if (res.ok) {
                if (res.value) {
                    const snapshotsRes = await snapshotService.getSnapshots(chapterId);
                    const userPubkey = get(authStore).pubkey ?? undefined;
                    set({ 
                        chapter: {
                            ...res.value,
                            pubkey: res.value.pubkey ?? userPubkey
                        },
                        snapshots: snapshotsRes.ok ? snapshotsRes.value : [],
                        loadError: undefined,
                        loading: false,
                        isDirty: false
                    });
                } else {
                    set({ 
                        chapter: null, 
                        snapshots: [], 
                        loading: false, 
                        isDirty: false,
                        loadError: remoteError ?? 'Chapter not available'
                    });
                }
            } else {
                set({ 
                    chapter: null, 
                    snapshots: [], 
                    loading: false, 
                    isDirty: false,
                    loadError: remoteError ?? res.error?.message ?? 'Chapter not available'
                });
            }
        },
        updateContent: (content: string) => {
            update(s => {
                if (s.chapter) {
                    return { ...s, chapter: { ...s.chapter, contentMd: content }, isDirty: true };
                }
                return s;
            });
        },
        save: async () => {
            let state: CurrentChapterState | undefined;
            update(s => { state = s; return s; });
            
            // Only save if it's a local draft (UUID, not coordinate)
            if (state?.chapter && !state.chapter.id.includes(':')) {
                await chapterDraftService.updateChapter(state.chapter);
                update(s => ({ ...s, isDirty: false }));
            }
        },
        createSnapshot: async (reason: string) => {
             let state: CurrentChapterState | undefined;
             update(s => { state = s; return s; });
             
             if (state?.chapter && !state.chapter.id.includes(':')) {
                 const res = await snapshotService.createSnapshot(state.chapter.id, state.chapter.contentMd, reason);
                 if (res.ok) {
                     update(s => ({ ...s, snapshots: [res.value, ...s.snapshots] }));
                 }
             }
        }
    };
}

export const currentChapterStore = createCurrentChapterStore();
