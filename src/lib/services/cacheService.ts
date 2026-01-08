type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const STORAGE_KEY = 'binder_cache_entries';

function loadEntries(): Record<string, CacheEntry<unknown>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveEntries(entries: Record<string, CacheEntry<unknown>>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full? ignoring
  }
}

function purgeExpired(entries: Record<string, CacheEntry<unknown>>) {
  const now = Date.now();
  for (const key of Object.keys(entries)) {
    if (entries[key].expiresAt <= now) {
      delete entries[key];
    }
  }
}

type CacheListener = (value: unknown) => void;
const listeners = new Map<string, Set<CacheListener>>();

function notifyCacheUpdate(key: string, value: unknown) {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(value);
    } catch (err) {
      console.error('Cache listener error', err);
    }
  }
}

export function onCacheUpdate(key: string, listener: CacheListener) {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => offCacheUpdate(key, listener);
}

export function offCacheUpdate(key: string, listener: CacheListener) {
  const set = listeners.get(key);
  if (!set) return;
  set.delete(listener);
  if (set.size === 0) {
    listeners.delete(key);
  }
}

export function getCached<T>(key: string, ttlMs: number): T | null {
  const entries = loadEntries();
  purgeExpired(entries);
  const raw = entries[key] as CacheEntry<T> | undefined;
  if (!raw) return null;
  if (raw.expiresAt <= Date.now()) {
    delete entries[key];
    saveEntries(entries);
    return null;
  }
  return raw.value;
}

export function setCached<T>(key: string, value: T, ttlMs: number) {
  const entries = loadEntries();
  purgeExpired(entries);
  entries[key] = {
    value,
    expiresAt: Date.now() + ttlMs
  };
  saveEntries(entries);
  notifyCacheUpdate(key, value);
}
