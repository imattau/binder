import { authStore } from '$lib/state/authStore';
import { get } from 'svelte/store';
import { getPublicKey, nip44 } from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha256';
import { hexToBytes } from '@noble/hashes/utils';
import { utf8Encoder } from '$lib/utils/encoding';
import { nip07Adapter } from '$lib/infra/nostr/nip07Adapter';
import { ok, fail, type Result } from '$lib/domain/result';

interface DerivedKey {
  privKey: string;
  pubKey: string;
}

const keyCache = new Map<string, DerivedKey>();

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function deriveKeyFromSecret(secret: string): DerivedKey {
  const secretBytes = utf8Encoder.encode(secret);
  const hashed = sha256(secretBytes) as Uint8Array;
  const privKey = bufferToHex(hashed);
  const pubKey = getPublicKey(hashed);
  return { privKey, pubKey };
}

async function buildSeedSignature(): Promise<Result<string>> {
  if (!nip07Adapter.detect()) {
    return fail({ message: 'NIP-07 signer not available' });
  }
  try {
    const seedEvent = {
      kind: 40013,
      created_at: 1,
      tags: [],
      content: 'Binder sync key seed'
    };
    const signed = await nip07Adapter.signEvent(seedEvent);
    return ok(signed.sig);
  } catch (error) {
    return fail({ message: 'Failed to sign sync seed', cause: error });
  }
}

export async function getScopedSyncKey(scope: string): Promise<Result<DerivedKey>> {
  if (keyCache.has(scope)) {
    return ok(keyCache.get(scope)!);
  }

  const auth = get(authStore);
  if (!auth.pubkey) {
    return fail({ message: 'User not authenticated' });
  }

  let baseKey = '';
  if (auth.nip46LocalKey) {
    baseKey = `${auth.nip46LocalKey}:${scope}`;
  } else {
    const seedRes = await buildSeedSignature();
    if (!seedRes.ok) {
      return fail(seedRes.error);
    }
    baseKey = `${seedRes.value}:${scope}`;
  }

  const derived = deriveKeyFromSecret(baseKey);
  keyCache.set(scope, derived);
  return ok(derived);
}

export function getConversationKey(syncKey: DerivedKey) {
  const { privKey, pubKey } = syncKey;
  const privateBytes = hexToBytes(privKey);
  return nip44.v2.utils.getConversationKey(privateBytes, pubKey);
}
