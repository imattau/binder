export interface PageConfig {
  coverImage?: string;
  iconImage?: string;
}

const STORAGE_KEY = 'binder_page_config';

export const pageConfigService = {
  getConfig(): PageConfig {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    try {
      return JSON.parse(stored);
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
  },
  saveConfig(config: PageConfig) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
};
