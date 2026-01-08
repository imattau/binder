import { pool, getActiveRelays } from '$lib/infra/nostr/pool';
import { ok, fail, type Result } from '$lib/domain/result';
import type { NostrEvent } from 'nostr-tools';
import type { ZapDetails } from '$lib/domain/types';

interface LnurlpResponse {
    callback: string;
    minSendable: number;
    maxSendable: number;
    tag: string;
    allowsNostr?: boolean;
    nostrPubkey?: string;
    nostrCommentAllowed?: number;
    metadata?: string;
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

async function lookupProfile(pubkey: string): Promise<Result<{ lud16?: string; lud06?: string }>> {
    const relays = await getActiveRelays();
    if (relays.length === 0) return fail({ message: 'No active relays' });

    try {
        const profile = await pool.get(relays, {
            kinds: [0],
            authors: [pubkey]
        });

        if (!profile) return fail({ message: 'Profile not found' });

        const content = JSON.parse(profile.content);
        return ok(content);
    } catch (error) {
        return fail({ message: 'Failed to fetch profile', cause: error });
    }
}

function parseLightningAddress(lud16: string): Result<{ name: string; domain: string }> {
    const [rawName, rawDomain] = lud16.split('@');
    if (!rawName || !rawDomain) {
        return fail({ message: 'Invalid lightning address' });
    }

    const name = rawName.trim();
    const domain = rawDomain.trim().toLowerCase();
    if (!name || !domain) {
        return fail({ message: 'Invalid lightning address' });
    }

    return ok({ name, domain });
}

function ensureLnurlResponse(data: LnurlpResponse): Result<ZapDetails> {
    if (data.tag !== 'payRequest' || !data.callback) {
        return fail({ message: 'LNURL response missing callback' });
    }

    const minSendable = data.minSendable;
    const maxSendable = data.maxSendable;
    if (!minSendable && !maxSendable) {
        return fail({ message: 'LNURL did not expose min or max sendable amount' });
    }

        return ok({
            callback: data.callback,
            minSendable,
            maxSendable,
            allowsNostr: data.allowsNostr,
            nostrPubkey: data.nostrPubkey,
            metadata: data.metadata,
            commentAllowed: data.nostrCommentAllowed
        });
}

export const zapService = {
    async resolveZapDetails(pubkey: string): Promise<Result<ZapDetails>> {
        const profileRes = await lookupProfile(pubkey);
        if (!profileRes.ok) return profileRes;

        const lud16 = profileRes.value.lud16;
        if (!lud16) {
            return fail({ message: 'No Lightning Address (lud16) found' });
        }

        const authRes = parseLightningAddress(lud16);
        if (!authRes.ok) return authRes;

        const { name, domain } = authRes.value;
        const lnurlUrl = `https://${domain}/.well-known/lnurlp/${name}`;
        const lnurlRes = await fetchJson(lnurlUrl);
        if (!lnurlRes.ok) return fail({ message: 'Failed to resolve LNURL', cause: lnurlRes.error });

        return ensureLnurlResponse(lnurlRes.value as LnurlpResponse);
    },

    async requestZap(details: ZapDetails, amount: number, nostrPubkey?: string, comment?: string): Promise<Result<string>> {
        const minSendable = details.minSendable || 0;
        const maxSendable = details.maxSendable || Infinity;
        if (amount < minSendable || amount > maxSendable) {
            return fail({ message: 'Requested amount is outside the allowed range' });
        }

        const callbackUrl = new URL(details.callback);
        callbackUrl.searchParams.set('amount', amount.toString());

        if (details.allowsNostr && nostrPubkey) {
            callbackUrl.searchParams.set('nostr', nostrPubkey);
        }

        if (comment) {
            callbackUrl.searchParams.set('comment', comment);
        }

        const invoiceRes = await fetchJson(callbackUrl.toString());
        if (!invoiceRes.ok) return fail({ message: 'Failed to request invoice', cause: invoiceRes.error });

        if (!invoiceRes.value.pr) {
            return fail({ message: 'LNURL callback did not return an invoice' });
        }

        return ok(invoiceRes.value.pr as string);
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
