import { nip07Adapter } from '$lib/infra/nostr/nip07Adapter';
import { relaySettingsRepo } from '$lib/infra/storage/relaySettingsRepo';
import { wsProbe } from '$lib/infra/net/wsProbe';
import { ok, type Result } from '$lib/domain/result';
import type { HealthReport, RelayCheckResult } from '$lib/domain/types';
import { get } from 'svelte/store';
import { authStore } from '$lib/state/authStore';

export const healthService = {
    async getHealthReport(): Promise<Result<HealthReport>> {
        const relaySettings = await relaySettingsRepo.getAll();
        const relayChecks: RelayCheckResult[] = [];

        if (relaySettings.ok) {
            for (const relay of relaySettings.value) {
                if (!relay.enabled) continue;
                const probe = await wsProbe.probe(relay.url);
                if (probe.ok) {
                    relayChecks.push({ url: relay.url, ok: true, latency: probe.value });
                } else {
                    relayChecks.push({ url: relay.url, ok: false, error: probe.error.message });
                }
            }
        }

        const report: HealthReport = {
            app: {
                version: (import.meta.env.VITE_APP_VERSION as string) || '0.0.1',
                mode: import.meta.env.MODE,
                pwa: typeof window !== 'undefined' && 'serviceWorker' in navigator
            },
            signer: {
                nip07: nip07Adapter.detect(),
                nip46: get(authStore).signerType === 'nip46'
            },
            storage: {
                indexedDb: await relaySettingsRepo.checkDb(),
                settingsLoaded: relaySettings.ok
            },
            relays: relayChecks
        };

        return ok(report);
    }
};
