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
}
