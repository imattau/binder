<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import Input from './Input.svelte';
  import { authService } from '$lib/services/authService';
  import QRCode from 'qrcode';
  import Tabs from './Tabs.svelte';

  let { isOpen, onClose, onLogin }: { isOpen: boolean, onClose: () => void, onLogin: (pubkey: string) => void } = $props();

  let mode = $state('scan'); // 'scan' | 'manual'
  let bunkerUrl = $state('');
  let isConnecting = $state(false);
  let error = $state('');
  let qrDataUrl = $state('');
  let scanUri = $state('');
  let copyStatus = $state('');
  let scanFlowToken: { cancelled: boolean } | null = null;

  // Reset state when opened
  $effect(() => {
      if (!isOpen) {
          cancelScanFlow();
          // Cleanup
          scanUri = '';
          qrDataUrl = '';
          isConnecting = false;
          error = '';
          copyStatus = '';
          return;
      }

      if (mode !== 'scan') {
          cancelScanFlow();
          scanUri = '';
          qrDataUrl = '';
          isConnecting = false;
          return;
      }

      if (mode === 'scan' && !scanUri) {
          startScanFlow();
      }
  });

  function cancelScanFlow() {
      if (scanFlowToken) {
          scanFlowToken.cancelled = true;
          scanFlowToken = null;
      }
  }

  async function startScanFlow() {
      if (scanFlowToken) return;

      const token = { cancelled: false };
      scanFlowToken = token;

      isConnecting = true;
      error = '';

      try {
          const res = await authService.createNip46Connection();
          if (token.cancelled) return;

          if (!res.ok) {
              error = res.error.message;
              return;
          }

          scanUri = res.value.uri;
          if (token.cancelled) return;

          qrDataUrl = await QRCode.toDataURL(scanUri, {
              width: 220,
              margin: 1,
              errorCorrectionLevel: 'L' // Lower complexity for faster generation
          });

          if (token.cancelled) return;

          const pubkey = await res.value.waitForUser();
          if (token.cancelled) return;

          onLogin(pubkey);
          onClose();
      } catch (e: any) {
          if (!token.cancelled && isOpen) error = e.message || 'Connection failed';
      } finally {
          if (scanFlowToken === token) {
              scanFlowToken = null;
          }
          isConnecting = false;
      }
  }

  async function handleManualConnect() {
      if (!bunkerUrl.trim()) return;
      isConnecting = true;
      error = '';
      
      const res = await authService.loginWithNip46(bunkerUrl.trim());
      isConnecting = false;
      
      if (res.ok) {
          onLogin(res.value.pubkey);
          onClose();
      } else {
          error = res.error.message;
      }
  }

  async function copyConnectionString() {
      if (!scanUri) return;
      try {
          await navigator.clipboard.writeText(scanUri);
          copyStatus = 'Copied';
      } catch (e: any) {
          copyStatus = 'Unavailable';
      } finally {
          setTimeout(() => {
              copyStatus = '';
          }, 2000);
      }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-float max-w-md w-full p-6 border border-slate-100">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
            <Icon name="Lightning" class="text-violet-600" size={24} />
            <h3 class="text-lg font-bold text-slate-900">Connect Signer</h3>
        </div>
        <button onclick={onClose} class="text-slate-400 hover:text-slate-600">
            <Icon name="X" size={24} />
        </button>
      </div>

      <div class="mb-6">
          <Tabs 
              items={[{ id: 'scan', label: 'Scan QR' }, { id: 'manual', label: 'Enter Address' }]} 
              activeItem={mode} 
              onchange={(id: string) => { mode = id; error = ''; }}
          />
      </div>

      <div class="min-h-[250px] flex flex-col">
        {#if error}
            <div class="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm border border-rose-100 mb-4">
                {error}
            </div>
        {/if}

        {#if mode === 'scan'}
          <div class="flex flex-col items-center justify-center flex-grow text-center">
              {#if qrDataUrl}
                  <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-100 mb-4">
                      <img src={qrDataUrl} alt="Nostr Connect QR" width="220" height="220" />
                  </div>
                  <p class="text-sm text-slate-600 mb-2">Scan with your Nostr signing app</p>
                  <p class="text-xs text-slate-400">Waiting for connection...</p>
                  <div class="mt-4 w-full">
                      <p class="text-[10px] uppercase tracking-wide text-slate-400 mb-1 inline-block">Connection string</p>
                      <div class="flex items-center rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono p-2">
                          <span class="flex-1 break-all text-slate-600">{scanUri || 'Generating...'}</span>
                          <button
                              type="button"
                              class="ml-2 px-3 py-1 text-xs font-semibold rounded bg-white border border-slate-200 hover:bg-slate-50 transition"
                              onclick={copyConnectionString}
                              disabled={!scanUri}
                          >
                              {copyStatus || 'Copy'}
                          </button>
                      </div>
                  </div>
              {:else}
                    <div class="py-8">
                        <Icon name="Pulse" class="animate-spin text-violet-500 mx-auto mb-2" size={32} />
                        <p class="text-slate-500">Generating connection...</p>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="space-y-4">
                <p class="text-sm text-slate-500">
                    Enter your Bunker address (e.g. user@domain.com) to initiate the connection.
                </p>
                <div>
                    <label for="bunker" class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Bunker Address</label>
                    <Input bind:value={bunkerUrl} placeholder="name@domain.com" disabled={isConnecting && mode === 'manual'} />
                </div>
                <div class="pt-4">
                    <Button onclick={handleManualConnect} disabled={(isConnecting && mode === 'manual') || !bunkerUrl} class="w-full">
                        {#if isConnecting}
                            <Icon name="Pulse" class="animate-spin mr-2" size={16} /> Connecting...
                        {:else}
                            Connect
                        {/if}
                    </Button>
                </div>
            </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
