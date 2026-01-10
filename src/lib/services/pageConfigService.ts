import { ok, fail, type Result } from '$lib/domain/result';
import { signerService } from './signerService';
import { settingsService } from './settingsService';
import { pool, fetchEvents } from '$lib/infra/nostr/pool';
import type { EventTemplate } from 'nostr-tools';

export interface PageConfig {
  coverImage?: string;
  iconImage?: string;
  showArticlesAsChapters?: boolean;
  lastUpdated?: number;
}

const STORAGE_KEY = 'binder_page_config';
const APP_DATA_KIND = 30078;
const CONFIG_D_TAG = 'binder-config';

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
    config.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  async syncToNetwork(config: PageConfig): Promise<Result<void>> {
    const pubkeyRes = await signerService.getPublicKey();
    if (!pubkeyRes.ok) return fail(pubkeyRes.error);

    const relaysRes = await settingsService.getRelays();
    if (!relaysRes.ok) return fail(relaysRes.error);
    const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);

    if (relays.length === 0) return fail({ message: 'No active relays' });

    const template: EventTemplate = {
        kind: APP_DATA_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', CONFIG_D_TAG]],
        content: JSON.stringify(config)
    };

    const signedRes = await signerService.signEvent(template);
    if (!signedRes.ok) return fail(signedRes.error);

    const event = signedRes.value;
    await Promise.allSettled(pool.publish(relays, event));
    
    return ok(undefined);
  },

  async fetchFromNetwork(pubkey: string): Promise<Result<PageConfig | null>> {
      const relaysRes = await settingsService.getRelays();
      if (!relaysRes.ok) return fail(relaysRes.error);
      const relays = relaysRes.value.filter(r => r.enabled).map(r => r.url);

      if (relays.length === 0) return ok(null);

      try {
          const events = await fetchEvents(relays, [{
              kinds: [APP_DATA_KIND],
              authors: [pubkey],
              '#d': [CONFIG_D_TAG],
              limit: 1
          }]);

          if (events.length === 0) return ok(null);

          const event = events[0];
          const config = JSON.parse(event.content) as PageConfig;
          
          return ok(config);
      } catch (e) {
          return fail({ message: 'Failed to fetch config', cause: e });
      }
  }
};
