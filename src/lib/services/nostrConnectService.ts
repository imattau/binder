import NDK, { NDKNip46Signer, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
import { ndk } from '$lib/infra/nostr/ndk';
import { createNostrConnectURI } from 'nostr-tools/nip46';
import { generateSecretKey } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';

const defaultHandshakeRelays = [
  'wss://nos.lol',
  'wss://relay.damus.io'
];

function generateNostrConnectSecret(): string {
  return Math.random().toString(36).substring(2, 15);
}

export interface NostrConnectSessionOptions {
  relays?: string[];
  name?: string;
  url?: string;
  perms?: string[];
  metadata?: Record<string, string>;
  waitForUserTimeoutMs?: number;
  rpcTimeoutMs?: number;
  secret?: string;
  localKey?: string;
}

export interface NostrConnectSession {
  uri: string;
  localKey: string;
  localPubkey: string;
  secret: string;
  relays: string[];
  waitForUser: () => Promise<NostrConnectResponse>;
}

export interface NostrConnectResponse {
  user: NDKUser;
  signer: NDKNip46Signer;
  remotePubkey: string;
}

export function createResilientNip46Signer(
  remoteId: string,
  localSigner: NDKPrivateKeySigner,
  relayUrls?: string[]
): NDKNip46Signer {
  const signer = new NDKNip46Signer(ndk, remoteId, localSigner, relayUrls);

  if (remoteId.length === 64 && !remoteId.includes('@')) {
    // Forcing the bunker pubkey ensures the signer resolves owners correctly
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    signer.bunkerPubkey = remoteId;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    if (signer.rpc) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signer.rpc.bunkerPubkey = remoteId;
    }
  }

  ndk.signer = signer;
  return signer;
}

export async function initiateNostrConnectSession(options: NostrConnectSessionOptions = {}): Promise<NostrConnectSession> {
  const relays = options.relays ?? [...defaultHandshakeRelays];
  const handshakeNdk = new NDK({
    explicitRelayUrls: relays,
    autoConnectUserRelays: false,
    clientName: 'Binder'
  });

  const localKey = options.localKey ?? bytesToHex(generateSecretKey());
  const localSigner = new NDKPrivateKeySigner(localKey);
  const localUser = await localSigner.user();
  const secret = options.secret ?? generateNostrConnectSecret();

  const metadata = {
    name: options.name ?? 'Binder',
    url: options.url ?? (typeof window !== 'undefined' ? window.location.origin : 'https://binder.app'),
    ...(options.metadata ?? {})
  };

  const perms = options.perms ?? ['sign_event', 'nip04_encrypt', 'nip04_decrypt'];

  const uri = createNostrConnectURI({
    clientPubkey: localUser.pubkey,
    relays,
    secret,
    name: metadata.name,
    url: metadata.url,
    perms
  });

  const waitForUser = async (): Promise<NostrConnectResponse> => {
    await handshakeNdk.connect();

    return new Promise<NostrConnectResponse>((resolve, reject) => {
      const sub = handshakeNdk.subscribe(
        {
          kinds: [24133],
          '#p': [localUser.pubkey]
        },
        { closeOnEose: false }
      );

      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        sub.stop();
        handshakeNdk.pool.relays.forEach((relay) => relay.disconnect());
      };

      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Connection timed out'));
      }, options.waitForUserTimeoutMs ?? 120000);

      sub.on('event', async (event) => {
        cleanup();
        try {
          const signer = createResilientNip46Signer(event.pubkey, localSigner, relays);
          signer.secret = secret;
          signer.relayUrls = relays;

          const user = await Promise.race([
            signer.user(),
            new Promise<NDKUser>((_, rejectRpc) =>
              setTimeout(
                () => rejectRpc(new Error('RPC verification timeout')),
                options.rpcTimeoutMs ?? 60000
              )
            )
          ]);

          resolve({ user, signer, remotePubkey: event.pubkey });
        } catch (err) {
          reject(err);
        }
      });

    });
  };

  return {
    uri,
    localKey,
    localPubkey: localUser.pubkey,
    secret,
    relays,
    waitForUser
  };
}
