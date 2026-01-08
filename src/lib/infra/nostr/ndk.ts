import NDK from '@nostr-dev-kit/ndk';
import { getActiveRelays } from './pool';

const HEX64_DOMAIN = /^[0-9a-f]{64}$/i;

function shouldSkipNip05Fetch(url: string): boolean {
	try {
		const hostname = new URL(url).hostname;
		return HEX64_DOMAIN.test(hostname);
	} catch {
		return false;
	}
}

function emptyNip05Response(): Response {
	return new Response(JSON.stringify({ names: {} }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

async function nip05Fetch(input: string | URL | Request, init?: RequestInit) {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

	if (shouldSkipNip05Fetch(url)) {
		return emptyNip05Response();
	}

	return fetch(input, init);
}

export const ndk = new NDK();

ndk.httpFetch = nip05Fetch;

export async function connectNDK() {
    try {
        const relays = await getActiveRelays();
        relays.forEach(r => {
            if (!ndk.pool.relays.has(r)) {
                ndk.addExplicitRelay(r);
            }
        });
        await ndk.connect();
    } catch (e) {
        console.error('Failed to connect NDK', e);
    }
}