import { writable } from 'svelte/store';

export type ThemePreference = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'binder_theme_preference';

function getInitialPreference(): ThemePreference {
    if (typeof window === 'undefined') {
        return 'auto';
    }
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        return stored;
    }
    return 'auto';
}

const preference = getInitialPreference();
const preferenceStore = writable<ThemePreference>(preference);
let currentPreference = preference;
let systemTheme = typeof window !== 'undefined' && window.matchMedia
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : 'light';

function applyTheme(pref: ThemePreference) {
    const theme = pref === 'auto' ? systemTheme : pref;
    if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = theme;
    }
}

function persistPreference(pref: ThemePreference) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, pref);
}

if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        systemTheme = mq.matches ? 'dark' : 'light';
        if (currentPreference === 'auto') {
            applyTheme(currentPreference);
        }
    };
    mq.addEventListener('change', handleChange);
}

applyTheme(currentPreference);

export const themeStore = {
    subscribe: preferenceStore.subscribe,
    setTheme(pref: ThemePreference) {
        currentPreference = pref;
        preferenceStore.set(pref);
        persistPreference(pref);
        applyTheme(pref);
    },
    get current() {
        return currentPreference;
    }
};
