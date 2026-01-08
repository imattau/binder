import type { EventTemplate, NostrEvent } from 'nostr-tools';

export const nip07Adapter = {
    detect(): boolean {
        // @ts-ignore
        return typeof window !== 'undefined' && !!window.nostr;
    },

    async getPublicKey(): Promise<string> {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.nostr) {
            // @ts-ignore
            return window.nostr.getPublicKey();
        }
        throw new Error('NIP-07 extension not found');
    },

    async signEvent(event: EventTemplate): Promise<NostrEvent> {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.nostr) {
            // @ts-ignore
            return window.nostr.signEvent(event);
        }
        throw new Error('NIP-07 extension not found');
    }
};