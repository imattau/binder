import { offlineRepo } from '$lib/infra/storage/offlineRepo';
import { subscriptions } from '$lib/infra/nostr/subscriptions';
import { ok, fail, type Result } from '$lib/domain/result';
import type { PublishedBook, PublishedChapter, OfflineJob, OfflineStatus } from '$lib/domain/types';
import { v4 as uuidv4 } from 'uuid';

export const offlineService = {
    async pinBook(pubkey: string, bookD: string): Promise<Result<void>> {
        const id = `${pubkey}:${bookD}`;
        const existing = await offlineRepo.getBook(id);
        
        if (existing.ok && existing.value) {
            existing.value.pinned = true;
            await offlineRepo.saveBook(existing.value);
        } else {
            // Fetch book event first if not in cache? 
            // Assume caller handles initial fetch or we fetch it now.
            // For robust pinning, we should start a job.
            
            const job: OfflineJob = {
                id: uuidv4(),
                type: 'cache_book',
                targetId: id,
                status: 'pending',
                progress: 0,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await offlineRepo.saveJob(job);
            
            // Trigger processing (in background ideally, but here async)
            this.processJobs(); 
        }
        return ok(undefined);
    },

    async unpinBook(pubkey: string, bookD: string): Promise<Result<void>> {
        const id = `${pubkey}:${bookD}`;
        const existing = await offlineRepo.getBook(id);
        if (existing.ok && existing.value) {
            existing.value.pinned = false;
            await offlineRepo.saveBook(existing.value);
        }
        return ok(undefined);
    },

    async getOfflineStatus(pubkey: string, bookD: string): Promise<Result<OfflineStatus>> {
        const id = `${pubkey}:${bookD}`;
        const bookRes = await offlineRepo.getBook(id);
        
        if (!bookRes.ok || !bookRes.value) {
            return ok({ pinned: false, ready: false });
        }
        
        const book = bookRes.value;
        // Check if all chapters are cached
        // In real app, we verify chapterRefs against cached chapters
        
        return ok({
            pinned: book.pinned,
            ready: true, // Simplified for now
            lastUpdated: book.refreshedAt,
            error: book.lastError
        });
    },

    async processJobs() {
        const jobsRes = await offlineRepo.getPendingJobs();
        if (!jobsRes.ok) return;

        for (const job of jobsRes.value) {
            // Update to processing
            job.status = 'processing';
            await offlineRepo.saveJob(job);

            try {
                const [pubkey, bookD] = job.targetId.split(':');
                
                // 1. Fetch Book
                const books = await subscriptions.fetchDiscoveryBooks([pubkey], 0); // 0 = all time
                if (!books.ok) throw new Error('Failed to fetch book');
                const bookEvent = books.value.find(e => e.tags.find(t => t[0] === 'd')?.[1] === bookD);
                
                if (!bookEvent) throw new Error('Book not found on relays');

                // 2. Parse Chapters
                const chapterRefs = bookEvent.tags
                    .filter(t => t[0] === 'a')
                    .map(t => t[1].split(':')[2]); // Extract d-tag from kind:pubkey:d

                // 3. Save Book Metadata
                const book: PublishedBook = {
                    id: job.targetId,
                    pubkey,
                    bookD,
                    bookEvent,
                    chapterRefs,
                    pinned: true,
                    cachedAt: Date.now(),
                    refreshedAt: Date.now()
                };
                await offlineRepo.saveBook(book);

                // 4. Fetch Chapters
                // Fetch individually or batched? Batch by author/kind/d list
                // subscriptions needs a fetchByDList method? Or just loop.
                // Loop for simplicity now.
                
                let cachedCount = 0;
                for (const chapterD of chapterRefs) {
                    const chEvents = await subscriptions.fetchFeed({
                        kinds: [30023],
                        authors: [pubkey],
                        '#d': [chapterD]
                    });
                    
                    if (chEvents.ok && chEvents.value.length > 0) {
                        const chEvent = chEvents.value[0];
                        const chapter: PublishedChapter = {
                            id: `${pubkey}:${chapterD}`,
                            pubkey,
                            chapterD,
                            chapterEvent: chEvent,
                            cachedAt: Date.now()
                        };
                        await offlineRepo.saveChapter(chapter);
                        cachedCount++;
                        
                        // Update Job Progress
                        job.progress = Math.round((cachedCount / chapterRefs.length) * 100);
                        await offlineRepo.saveJob(job);
                    }
                }

                job.status = 'completed';
                job.updatedAt = Date.now();
                await offlineRepo.saveJob(job);

            } catch (e: any) {
                job.status = 'failed';
                job.error = e.message;
                job.updatedAt = Date.now();
                await offlineRepo.saveJob(job);
            }
        }
    }
};
