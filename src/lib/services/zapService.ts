import { pool, getActiveRelays } from '$lib/infra/nostr/pool';
import { ok, fail, type Result } from '$lib/domain/result';
import type { NostrEvent } from 'nostr-tools';

interface LnurlpResponse {
    callback: string;
    minSendable: number;
    maxSendable: number;
    tag: string;
    allowsNostr?: boolean;
    nostrPubkey?: string;
    nostrCommentAllowed?: number;
}

async function fetchJson(url: string): Promise<Result<any>> {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            return fail({ message: `Request failed (${res.status})` });
        }
        return ok(await res.json());
    } catch (error) {
        return fail({ message: 'Network request failed', cause: error });
    }
}

export const zapService = {
    async requestZap(pubkey: string): Promise<Result<string>> {
        const relays = await getActiveRelays();
        if (relays.length === 0) return fail({ message: 'No active relays' });

        try {
            const profile = await pool.get(relays, {
                kinds: [0],
                authors: [pubkey]
            });

            if (!profile) return fail({ message: 'Profile not found' });

            const content = JSON.parse(profile.content);
            const lud16 = content.lud16;

            if (!lud16) {
                return fail({ message: 'No Lightning Address (lud16) found' });
            }

            const [rawName, rawDomain] = lud16.split('@');
            if (!rawName || !rawDomain) {
                return fail({ message: 'Invalid lightning address' });
            }

            const name = rawName.trim();
            const domain = rawDomain.trim().toLowerCase();
            if (!name || !domain) {
                return fail({ message: 'Invalid lightning address' });
            }

            const lnurlUrl = `https://${domain}/.well-known/lnurlp/${name}`;
            const lnurlRes = await fetchJson(lnurlUrl);
            if (!lnurlRes.ok) return fail({ message: 'Failed to resolve LNURL', cause: lnurlRes.error });

            const lnurlData = lnurlRes.value as LnurlpResponse;
            if (lnurlData.tag !== 'payRequest' || !lnurlData.callback) {
                return fail({ message: 'LNURL response missing callback' });
            }

            const amount = lnurlData.minSendable || lnurlData.maxSendable;
            if (!amount) {
                return fail({ message: 'LNURL did not expose min or max sendable amount' });
            }
            const callbackUrl = new URL(lnurlData.callback);
            callbackUrl.searchParams.set('amount', amount.toString());

            if (lnurlData.allowsNostr && lnurlData.nostrPubkey) {
                callbackUrl.searchParams.set('nostr', pubkey);
            }

            const invoiceRes = await fetchJson(callbackUrl.toString());
            if (!invoiceRes.ok) return fail({ message: 'Failed to request invoice', cause: invoiceRes.error });

            if (!invoiceRes.value.pr) {
                return fail({ message: 'LNURL callback did not return an invoice' });
            }

            return ok(invoiceRes.value.pr as string);
        } catch (error) {
            return fail({ message: 'Failed to fetch zap endpoint', cause: error });
        }
    },

    async getZapReceipts(eventCoords: { kind: number; pubkey: string; d: string }): Promise<Result<NostrEvent[]>> {
        const relays = await getActiveRelays();
        if (relays.length === 0) return ok([]);

        const tag = `${eventCoords.kind}:${eventCoords.pubkey}:${eventCoords.d}`;

        try {
            const events = await pool.querySync(relays, {
                kinds: [9735],
                '#a': [tag]
            });
            return ok(events);
        } catch (error) {
            return fail({ message: 'Failed to fetch zap receipts', cause: error });
        }
    }
};
