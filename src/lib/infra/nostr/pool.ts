import { SimplePool, type Filter, type NostrEvent, verifyEvent } from 'nostr-tools';
import { relaySettingsRepo } from '$lib/infra/storage/relaySettingsRepo';

export const pool = new SimplePool();
pool.verifyEvent = verifyEvent;

export const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://nos.lol'
];

export async function getActiveRelays(): Promise<string[]> {
    const res = await relaySettingsRepo.getAll();
    if (res.ok && res.value.length > 0) {
        return res.value.filter(r => r.enabled).map(r => r.url);
    }
    // Return defaults if no settings found (Guest / First Load)
    return DEFAULT_RELAYS;
}

export function fetchEvents(relays: string[], filters: Filter[]): Promise<NostrEvent[]> {
    return new Promise((resolve) => {
        const events: NostrEvent[] = [];
        const sub = pool.subscribeMany(relays, filters as any, {
            onevent(event) {
                events.push(event);
            },
            oneose() {
                sub.close();
                resolve(events);
            }
        });
    });
}