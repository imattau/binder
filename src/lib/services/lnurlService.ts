import { ok, fail, type Result } from '$lib/domain/result';
import { bech32 } from 'bech32';

export interface LnurlPayMetadata {
    callback: string;
    maxSendable: number;
    minSendable: number;
    commentAllowed?: number;
    metadata: string;
    tag: string;
}

function decodeLnurlUrl(input: string): string {
    const normalized = input.trim().toLowerCase();
    const { prefix, words } = bech32.decode(normalized, 1500);
    if (!prefix.startsWith('lnurl')) {
        throw new Error('Input is not an LNURL');
    }
    const bytes = Uint8Array.from(bech32.fromWords(words));
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(bytes);
    }
    // Fallback for environments without TextDecoder
    return bytes.reduce((text, byte) => text + String.fromCharCode(byte), '');
}

export const lnurlService = {
    async decodeLnurl(input: string): Promise<Result<string>> {
        try {
            const decoded = decodeLnurlUrl(input);
            return ok(decoded);
        } catch (e: any) {
            return fail({ message: 'Invalid LNURL', cause: e });
        }
    },

    async fetchPayMetadata(lnurlBech: string): Promise<Result<LnurlPayMetadata>> {
        const decodedRes = await this.decodeLnurl(lnurlBech);
        if (!decodedRes.ok) return fail(decodedRes.error);

        try {
            const response = await fetch(decodedRes.value);
            if (!response.ok) throw new Error('LNURL metadata request failed');
            const data = await response.json();
            const payload: LnurlPayMetadata = {
                callback: data.callback,
                maxSendable: data.maxSendable,
                minSendable: data.minSendable,
                commentAllowed: data.commentAllowed,
                metadata: data.metadata,
                tag: data.tag
            };
            return ok(payload);
        } catch (e: any) {
            return fail({ message: 'Unable to reach LNURL endpoint', cause: e });
        }
    },

    async requestInvoice(callback: string, amountMsat: number, comment?: string): Promise<Result<string>> {
        try {
            const url = new URL(callback);
            url.searchParams.set('amount', amountMsat.toString());
            if (comment) {
                url.searchParams.set('comment', comment);
            }
            const response = await fetch(url.toString());
            if (!response.ok) throw new Error('LNURL invoice request failed');
            const data = await response.json();
            if (data.status === 'ERROR') {
                return fail({ message: data.reason || 'LNURL invoice error' });
            }
            if (!data.pr) {
                return fail({ message: 'LNURL did not return invoice' });
            }
            return ok(data.pr);
        } catch (e: any) {
            return fail({ message: 'Failed to request invoice', cause: e });
        }
    }
};
