import type { EventTemplate, NostrEvent } from 'nostr-tools';

export const nip07Adapter = {
    detect(): boolean {
        // @ts-ignore
        return typeof window !== 'undefined' && !!window.nostr;
    },

    async waitForExtension(timeout = 1000): Promise<boolean> {
        if (this.detect()) return true;

        const start = Date.now();
        while (Date.now() - start < timeout) {
            await new Promise(r => setTimeout(r, 100));
            if (this.detect()) return true;
        }
        return false;
    },

    async getPublicKey(): Promise<string> {
        await this.waitForExtension();
        // @ts-ignore
        if (typeof window !== 'undefined' && window.nostr) {
            // @ts-ignore
            return window.nostr.getPublicKey();
        }
        throw new Error('NIP-07 extension not found (requires HTTPS)');
    },

    async signEvent(event: EventTemplate): Promise<NostrEvent> {
        await this.waitForExtension();
        // @ts-ignore
        if (typeof window !== 'undefined' && window.nostr) {
            // @ts-ignore
            return window.nostr.signEvent(event);
        }
        throw new Error('NIP-07 extension not found (requires HTTPS)');
    }
};