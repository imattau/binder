import { relaySettingsRepo } from '$lib/infra/storage/relaySettingsRepo';
import { DEFAULT_RELAYS } from '$lib/infra/nostr/pool';
import type { RelaySetting } from '$lib/infra/storage/dexieDb';
import { ok, fail, type Result } from '$lib/domain/result';

export const relayDefaultsService = {
  async getDefaults(): Promise<Result<RelaySetting[]>> {
    const res = await relaySettingsRepo.getAll();
    if (res.ok && res.value.length > 0) {
      return ok(res.value);
    }
    return ok(DEFAULT_RELAYS.map(url => ({ url, enabled: true })));
  },

  async setDefaults(relays: RelaySetting[]): Promise<Result<void>> {
    return relaySettingsRepo.save(relays);
  },

  async resetToDefaults(): Promise<Result<void>> {
    const defaults = DEFAULT_RELAYS.map(url => ({ url, enabled: true }));
    return relaySettingsRepo.save(defaults);
  }
};
