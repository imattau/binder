import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type BookLayoutMode = 'list' | 'grid';

const STORAGE_KEY = 'binder_books_layout';

function createBookLayoutStore() {
  const initial: BookLayoutMode = browser ? (localStorage.getItem(STORAGE_KEY) as BookLayoutMode) || 'list' : 'list';
  const { subscribe, set } = writable<BookLayoutMode>(initial);

  return {
    subscribe,
    setLayout: (mode: BookLayoutMode) => {
      if (mode !== 'list' && mode !== 'grid') return;
      set(mode);
      if (browser) {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    }
  };
}

export const bookLayoutStore = createBookLayoutStore();
