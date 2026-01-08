export type RelayUrl = string;

export interface HealthReport {
    app: {
        version: string;
        mode: string;
        pwa: boolean;
    };
    signer: {
        nip07: boolean;
        nip46: boolean;
    };
    storage: {
        indexedDb: boolean;
        settingsLoaded: boolean;
    };
    relays: RelayCheckResult[];
}

export interface RelayCheckResult {
    url: RelayUrl;
    ok: boolean;
    latency?: number;
    error?: string;
}

export type CheckResult = { ok: true } | { ok: false; error: string };

// --- Task 2: Domain Models (Local Writer) ---

export type ChapterStatus = 'draft' | 'ready';

export interface LocalBook {
    id: string; // uuid
    d: string; // future d tag
    title: string;
    summary?: string;
    cover?: string; // URL to cover image
    tags: string[];
    chapterOrder: string[]; // List of chapter IDs
    createdAt: number;
    updatedAt: number;
    publishedHash?: string;
}

export interface LocalChapterDraft {
    id: string; // uuid
    d: string; // future d tag
    bookId: string;
    title: string;
    contentMd: string;
    status: ChapterStatus;
    createdAt: number;
    updatedAt: number;
    pubkey?: string;
    publishedHash?: string;
}

export interface DraftSnapshot {
    id: string; // uuid
    chapterId: string;
    contentMd: string;
    reason: string;
    createdAt: number;
}

// --- Task 5: Domain Models (Discovery & Library) ---

export interface SavedBook {
    id: string; // d-tag usually, or combined kind:pubkey:d
    kind: number;
    pubkey: string;
    d: string;
    title: string;
    summary?: string;
    authorName?: string;
    coverUrl?: string; // Optional
    shelves: string[]; // List of shelf IDs
    addedAt: number;
}

export interface ReadingProgress {
    bookId: string; // matches SavedBook.id
    lastChapterId?: string; // d-tag of chapter
    percent: number; // 0-100
    updatedAt: number;
}

export interface Shelf {
    id: string;
    name: string;
    isSystem: boolean; // e.g. "Favorites"
    createdAt: number;
}

// Feed Types
import type { NostrEvent } from 'nostr-tools';

export interface AuthorProfile {
    pubkey: string;
    name?: string;
    displayName?: string;
    picture?: string;
    about?: string;
    nip05?: string;
}

export interface FeedItem {
    event: NostrEvent;
    type: 'chapter' | 'book';
    reason?: string; // Explainability
    score?: number; // Sorting
}

export interface GroupedFeedItem {
    author: AuthorProfile;
    chapters: FeedItem[];
    lastUpdated: number; // For sorting groups
}

// --- Task 6: Offline Cache & Export ---

export interface PublishedBook {
    id: string; // pubkey:bookD
    pubkey: string;
    bookD: string;
    bookEvent: NostrEvent;
    chapterRefs: string[]; // List of chapter d-tags or coords
    pinned: boolean;
    cachedAt: number;
    refreshedAt: number;
    lastError?: string;
}

export interface PublishedChapter {
    id: string; // pubkey:chapterD
    pubkey: string;
    chapterD: string;
    chapterEvent: NostrEvent;
    renderCache?: string; // Pre-rendered HTML
    cachedAt: number;
}

export type OfflineJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface OfflineJob {
    id: string;
    type: 'cache_book';
    targetId: string; // pubkey:bookD
    status: OfflineJobStatus;
    progress: number; // 0-100
    error?: string;
    createdAt: number;
    updatedAt: number;
}

export type OfflineStatus = {
    pinned: boolean;
    ready: boolean;
    progress?: number;
    lastUpdated?: number;
    error?: string;
};
