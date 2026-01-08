import Dexie, { type Table } from 'dexie';
import type { 
    LocalBook, LocalChapterDraft, DraftSnapshot, 
    SavedBook, ReadingProgress, Shelf,
    PublishedBook, PublishedChapter, OfflineJob 
} from '$lib/domain/types';

export interface RelaySetting {
    url: string;
    enabled: boolean;
}

export interface MediaServerSetting {
    url: string;
    enabled: boolean;
    provider: 'standard' | 'blossom' | 'custom';
}

export class BinderDb extends Dexie {
    relays!: Table<RelaySetting, string>;
    mediaServers!: Table<MediaServerSetting, string>;
    books!: Table<LocalBook, string>;
    chapters!: Table<LocalChapterDraft, string>;
    snapshots!: Table<DraftSnapshot, string>;
    
    // Task 5 additions
    savedBooks!: Table<SavedBook, string>;
    readingProgress!: Table<ReadingProgress, string>;
    shelves!: Table<Shelf, string>;

    // Task 6 additions
    publishedBooks!: Table<PublishedBook, string>;
    publishedChapters!: Table<PublishedChapter, string>;
    offlineJobs!: Table<OfflineJob, string>;

    constructor() {
        super('BinderDb');
        const version1Stores = {
            relays: 'url',
            books: 'id, d, updatedAt',
            chapters: 'id, bookId, d, updatedAt',
            snapshots: 'id, chapterId, createdAt'
        };

        const version2Stores = {
            ...version1Stores,
            savedBooks: 'id, kind, pubkey, d, addedAt, *shelves',
            readingProgress: 'bookId, updatedAt',
            shelves: 'id, name'
        };

        const version3Stores = {
            ...version2Stores,
            publishedBooks: 'id, pubkey, bookD, pinned',
            publishedChapters: 'id, pubkey, chapterD',
            offlineJobs: 'id, status'
        };

        const version4Stores = {
            ...version3Stores,
            mediaServers: 'url'
        };

        this.version(1).stores(version1Stores);
        this.version(2).stores(version2Stores);
        this.version(3).stores(version3Stores);
        this.version(4).stores(version4Stores);
    }
}

export const db = new BinderDb();
