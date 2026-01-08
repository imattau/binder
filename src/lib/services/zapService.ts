import { pool, getActiveRelays, fetchEvents } from '$lib/infra/nostr/pool';
import { ok, fail, type Result } from '$lib/domain/result';
import { type NostrEvent, type EventTemplate, nip57 } from 'nostr-tools';
import type { ZapDetails } from '$lib/domain/types';
import { signerService } from './signerService';

interface LnurlpResponse {
    callback: string;
    minSendable: number;
    maxSendable: number;
    tag: string;
    allowsNostr?: boolean;
    nostrPubkey?: string;
    nostrCommentAllowed?: number;
    metadata?: string;
    lnurl?: string;
}

// Add WebLN type definition
declare global {
  interface Window {
    webln?: {
      enable: () => Promise<void>;
      sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
    };
  }
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
        commentAllowed: data.nostrCommentAllowed,
        lnurl: data.lnurl
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

        // Temporarily passing the URL itself as we don't have a bech32 encoder handy. 
        // Ideally this should be bech32 encoded.
        const responseData = { ...lnurlRes.value, lnurl: lnurlUrl };
        return ensureLnurlResponse(responseData as LnurlpResponse & { lnurl: string });
    },

    async makeZapRequestEvent(
        recipientPubkey: string,
        amountSats: number,
        relays: string[],
        targetEvent?: { id?: string; kind?: number; pubkey?: string; d?: string },
        comment?: string,
        lnurl?: string
    ): Promise<Result<NostrEvent>> {
        const amountMillisats = amountSats * 1000;
        
        let params: any = {
            amount: amountMillisats,
            comment,
            relays
        };

        if (targetEvent && targetEvent.id) {
            // Construct a minimal event object for makeZapRequest
            // It needs id, pubkey, kind, and tags (for d-tag check)
            params.event = {
                id: targetEvent.id,
                pubkey: targetEvent.pubkey || recipientPubkey, // Fallback, though event should have pubkey
                kind: targetEvent.kind || 1, // Default to 1 (text note) if not specified
                tags: targetEvent.d ? [['d', targetEvent.d]] : []
            };
        } else {
            params.pubkey = recipientPubkey;
        }

        let template: EventTemplate;
        try {
            template = nip57.makeZapRequest(params);
        } catch (e: any) {
            return fail({ message: 'Failed to create zap request', cause: e });
        }

        if (lnurl) {
            template.tags.push(['lnurl', lnurl]);
        }

        return signerService.signEvent(template);
    },

    async fetchInvoice(
        details: ZapDetails,
        amountSats: number,
        zapRequestEvent?: NostrEvent,
        comment?: string
    ): Promise<Result<string>> {
        const amountMillisats = amountSats * 1000;

        // Validation
        if (amountMillisats < details.minSendable || amountMillisats > details.maxSendable) {
            return fail({ message: 'Requested amount is outside the allowed range' });
        }

        const callbackUrl = new URL(details.callback);
        callbackUrl.searchParams.set('amount', amountMillisats.toString());

        if (zapRequestEvent) {
             // Encode as JSON string
            callbackUrl.searchParams.set('nostr', JSON.stringify(zapRequestEvent));
        } else if (comment) {
            // Fallback for non-NIP-57 (just comment)
             callbackUrl.searchParams.set('comment', comment);
        }

        const invoiceRes = await fetchJson(callbackUrl.toString());
        if (!invoiceRes.ok) return fail({ message: 'Failed to request invoice', cause: invoiceRes.error });

        const pr = invoiceRes.value.pr;
        if (!pr) {
            return fail({ message: 'LNURL callback did not return an invoice (pr field missing)' });
        }

        return ok(pr as string);
    },

    async payViaWebLN(invoice: string): Promise<Result<string>> {
        if (typeof window === 'undefined' || !window.webln) {
            return fail({ message: 'WebLN not available' });
        }

        try {
            await window.webln.enable();
            const result = await window.webln.sendPayment(invoice);
            return ok(result.preimage);
        } catch (error) {
            return fail({ message: 'WebLN payment failed', cause: error });
        }
    },

    async getZapReceipts(target: { kind?: number; pubkey: string; d?: string; eventId?: string }): Promise<Result<NostrEvent[]>> {
        const relays = await getActiveRelays();
        if (relays.length === 0) return ok([]);

        const filter: any = { kinds: [9735] };
        
        if (target.eventId) {
            filter['#e'] = [target.eventId];
        }
        
        if (target.kind && target.pubkey && target.d) {
             filter['#a'] = [`${target.kind}:${target.pubkey}:${target.d}`];
        }

        // Fallback to profile zap if no specific event target
        if (!filter['#e'] && !filter['#a']) {
             filter['#p'] = [target.pubkey];
        }

        try {
            const events = await fetchEvents(relays, [filter]);
            return ok(events);
        } catch (error) {
            return fail({ message: 'Failed to fetch zap receipts', cause: error });
        }
    }
};