<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { ndk } from '$lib/infra/nostr/ndk';
  import NDK, { NDKNip46Signer, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
  import { generateSecretKey } from 'nostr-tools';
  import { bytesToHex } from '@noble/hashes/utils';
  import QRCode from 'qrcode';
  import Button from '$lib/ui/components/Button.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';

  let logs: string[] = $state([]);
  let qrCanvas: HTMLCanvasElement | null = $state(null);
  let uri = $state('');
  let status = $state('idle'); 

  function log(msg: string) {
      logs = [...logs, `[${new Date().toLocaleTimeString()}] ${msg}`];
      console.log(`[NIP46 Debug] ${msg}`);
  }

  $effect(() => {
      if (uri && qrCanvas) {
          untrack(() => log('Drawing QR Code...'));
          QRCode.toCanvas(qrCanvas, uri, { width: 300, margin: 1 }, (err) => {
              if (err) untrack(() => log(`QR Error: ${err.message}`));
              else untrack(() => log('QR Code drawn successfully'));
          });
      }
  });

  async function startTest() {
      status = 'listening';
      logs = [];
      uri = ''; 
      log('Starting NIP-46 Debug Test...');

      try {
          const handshakeRelays = ['wss://nos.lol', 'wss://relay.damus.io'];
          for (const r of handshakeRelays) {
              ndk.addExplicitRelay(r);
          }
          
          await ndk.connect();
          log('NDK Connected');

          const sk = generateSecretKey();
          const skHex = bytesToHex(sk);
          const localSigner = new NDKPrivateKeySigner(skHex);
          const localUser = await localSigner.user();
          const localPubkey = localUser.pubkey;
          log(`Ephemeral Local Pubkey: ${localPubkey}`);

          const metadata = JSON.stringify({ 
              name: 'Binder', 
              url: window.location.origin
          });
          const perms = 'sign_event,nip04_encrypt,nip04_decrypt';
          
          const relayParams = handshakeRelays.map(r => `relay=${encodeURIComponent(r)}`).join('&');
          uri = `nostrconnect://${localPubkey}?${relayParams}&metadata=${encodeURIComponent(metadata)}&perms=${encodeURIComponent(perms)}&name=Binder`;
          
          log(`URI Generated: ${uri}`);
          log(`Listening for connect events on ${handshakeRelays.join(', ')}...`);
          
          const sub = ndk.subscribe({
              kinds: [24133],
              '#p': [localPubkey]
          }, { closeOnEose: false });

          sub.on('event', async (event) => {
              log(`RECEIVED EVENT: kind=${event.kind} from=${event.pubkey}`);
              // Stop redundant events
              sub.stop(); 
              
              const remotePubkey = event.pubkey;
              status = 'connected';
              
              try {
                  log(`Initializing Signer for remote=${remotePubkey}`);
                  const nip46Signer = new NDKNip46Signer(ndk, remotePubkey, localSigner);
                  
                  // Force set properties
                  // @ts-ignore
                  nip46Signer.bunkerPubkey = remotePubkey;
                  // @ts-ignore
                  if (nip46Signer.rpc) {
                      // @ts-ignore
                      nip46Signer.rpc.bunkerPubkey = remotePubkey;
                  }
                  
                  nip46Signer.relayUrls = handshakeRelays;
                  ndk.signer = nip46Signer;

                  log('Sending "get_public_key" RPC...');
                  const u = await Promise.race([
                      nip46Signer.user(),
                      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RPC Timeout')), 15000))
                  ]);
                  
                  log(`SUCCESS: Remote confirmed pubkey: ${u.pubkey}`);
                  
                  if (u.pubkey === remotePubkey) {
                      log('VERIFIED: Handshake complete.');
                  }

              } catch (e: any) {
                  log(`Handshake Error: ${e.message}`);
              }
          });

      } catch (e: any) {
          log(`Setup Error: ${e.message}`);
          status = 'failed';
      }
  }
</script>

<div class="max-w-2xl mx-auto p-8">
    <h1 class="text-2xl font-bold mb-6 text-slate-900">NIP-46 Diagnostics</h1>
    
    <div class="mb-6 space-y-4">
        <div class="flex gap-4">
            <Button onclick={startTest} disabled={status === 'listening'}>
                {status === 'listening' ? 'Listening...' : 'Generate New QR'}
            </Button>
            {#if status === 'connected'}
                <div class="text-emerald-600 flex items-center gap-2 font-medium text-sm">
                    <Icon name="CheckCircle" /> Connection Verified
                </div>
            {/if}
        </div>
        
        {#if uri}
            <div class="flex flex-col md:flex-row gap-6 items-start">
                <div class="bg-white p-4 rounded-xl shadow-md border border-slate-100 inline-block shrink-0">
                    <canvas bind:this={qrCanvas}></canvas>
                </div>
                <div class="space-y-4 flex-1">
                    <p class="text-sm text-slate-600">Scan this code with a Nostr Signer app.</p>
                    <div class="text-[10px] font-mono bg-slate-100 p-3 rounded-lg break-all border border-slate-200 text-slate-500 max-h-32 overflow-y-auto">
                        {uri}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <div class="bg-slate-900 text-slate-50 p-4 rounded-xl font-mono text-[11px] h-96 overflow-y-auto shadow-inner border border-slate-800">
        <div class="text-slate-500 mb-2 border-b border-slate-800 pb-1 uppercase tracking-widest text-[9px]">Live Debug Logs</div>
        {#each logs as line}
            <div class="mb-1 border-b border-slate-800/50 pb-1 last:border-0">{line}</div>
        {/each}
        {#if logs.length === 0}
            <span class="text-slate-500 italic">Ready to test. Click the button above.</span>
        {/if}
    </div>
</div>
