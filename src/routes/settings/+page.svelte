<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/state/authStore';
  import { settingsStore } from '$lib/state/settingsStore';
  import { mediaSettingsStore } from '$lib/state/mediaSettingsStore';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import Card from '$lib/ui/components/Card.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import Input from '$lib/ui/components/Input.svelte';
  import type { MediaServerSetting } from '$lib/infra/storage/dexieDb';
  import { walletSettingsService, type ZapWalletConfig } from '$lib/services/walletSettingsService';
  import { lnurlService, type LnurlPayMetadata } from '$lib/services/lnurlService';

  const existingWalletConfig = walletSettingsService.getConfig();
  let walletConfig: ZapWalletConfig | null = existingWalletConfig;
  let lnurlInput = existingWalletConfig?.lnurl ?? '';
  let walletStatus = '';
  let lnurlMetadata: LnurlPayMetadata | null = existingWalletConfig ? {
      callback: existingWalletConfig.callback,
      maxSendable: existingWalletConfig.maxSendable,
      minSendable: existingWalletConfig.minSendable,
      commentAllowed: existingWalletConfig.commentAllowed,
      metadata: '',
      tag: existingWalletConfig.label
  } : null;

  let newRelayUrl = '';
  let newMediaServerUrl = '';
  let newMediaProvider: MediaServerSetting['provider'] = 'standard';

  onMount(() => {
    if (!$authStore.pubkey) {
        goto('/login');
        return;
    }
    settingsStore.load();
    mediaSettingsStore.load();
  });

  function addRelay() {
    if (!newRelayUrl) return;
    const current = $settingsStore;
    // Simple duplicate check
    if (current.some(r => r.url === newRelayUrl)) return;

    const updated = [...current, { url: newRelayUrl, enabled: true }];
    settingsStore.save(updated);
    newRelayUrl = '';
  }

  function removeRelay(url: string) {
    const updated = $settingsStore.filter(r => r.url !== url);
    settingsStore.save(updated);
  }

  function toggleRelay(url: string) {
      const updated = $settingsStore.map(r => 
          r.url === url ? { ...r, enabled: !r.enabled } : r
      );
      settingsStore.save(updated);
  }

  function addMediaServer() {
      if (!newMediaServerUrl) return;
      const current = $mediaSettingsStore;
      if (current.some(s => s.url === newMediaServerUrl)) return;

      const updated = [...current, { url: newMediaServerUrl, enabled: true, provider: newMediaProvider }];
      mediaSettingsStore.save(updated);
      newMediaServerUrl = '';
  }

  function removeMediaServer(url: string) {
      const updated = $mediaSettingsStore.filter(s => s.url !== url);
      mediaSettingsStore.save(updated);
  }

  function toggleMediaServer(url: string) {
      const updated = $mediaSettingsStore.map(s => 
          s.url === url ? { ...s, enabled: !s.enabled } : s
      );
      mediaSettingsStore.save(updated);
  }

  async function validateWalletLnurl() {
      if (!lnurlInput.trim()) {
          walletStatus = 'Enter a Lightning Address or LNURL string.';
          lnurlMetadata = null;
          return;
      }
      walletStatus = 'Looking up wallet...';
      const res = await lnurlService.fetchPayMetadata(lnurlInput.trim());
      if (res.ok) {
          lnurlMetadata = res.value;
          walletStatus = `LNURL ready (min ${res.value.minSendable / 1000} sats).`;
      } else {
          walletStatus = res.error.message;
          lnurlMetadata = null;
      }
  }

  function saveWallet() {
      if (!lnurlInput.trim() || !lnurlMetadata) return;
      const config: ZapWalletConfig = {
          label: lnurlMetadata.tag || 'zap wallet',
          lnurl: lnurlInput.trim(),
          callback: lnurlMetadata.callback,
          minSendable: lnurlMetadata.minSendable,
          maxSendable: lnurlMetadata.maxSendable,
          commentAllowed: lnurlMetadata.commentAllowed
      };
      const res = walletSettingsService.setConfig(config);
      if (res.ok) {
          walletConfig = config;
          walletStatus = 'Wallet saved.';
          lnurlMetadata = {
              ...lnurlMetadata,
              tag: config.label
          };
      } else {
          walletStatus = res.error.message;
      }
  }

  function clearWallet() {
      const res = walletSettingsService.clearConfig();
      if (res.ok) {
          walletConfig = null;
          walletStatus = 'Wallet cleared.';
          lnurlInput = '';
          lnurlMetadata = null;
      } else {
          walletStatus = res.error.message;
      }
  }
</script>

<SectionHeader title="Settings" subtitle="Manage your relay connections" />

<Card title="Relays">
  <div class="space-y-4">
    {#each $settingsStore as relay}
      <div class="flex items-center justify-between p-3 bg-slate-50 rounded-md">
        <div class="flex items-center gap-3 overflow-hidden">
            <input 
                type="checkbox" 
                checked={relay.enabled} 
                onchange={() => toggleRelay(relay.url)}
                class="h-4 w-4 text-violet-600 focus:ring-violet-500 border-slate-300 rounded"
            />
            <span class="text-sm font-mono text-slate-700 truncate">{relay.url}</span>
        </div>
        <Button variant="danger" onclick={() => removeRelay(relay.url)}>Remove</Button>
      </div>
    {/each}

    <div class="flex gap-2 mt-6 pt-4 border-t border-slate-200">
      <div class="flex-grow">
        <Input bind:value={newRelayUrl} placeholder="wss://relay.example.com" />
      </div>
      <Button onclick={addRelay}>Add Relay</Button>
    </div>
  </div>
</Card>

<Card title="Media Servers">
  <div class="space-y-4">
    {#each $mediaSettingsStore as server}
      <div class="flex items-center justify-between p-3 bg-slate-50 rounded-md">
        <div class="flex items-center gap-3 overflow-hidden">
            <input 
                type="checkbox" 
                checked={server.enabled} 
                onchange={() => toggleMediaServer(server.url)}
                class="h-4 w-4 text-violet-600 focus:ring-violet-500 border-slate-300 rounded"
            />
            <span class="text-sm font-mono text-slate-700 truncate">{server.url}</span>
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {server.provider === 'blossom' ? 'Blossom (NIP-98)' : server.provider === 'standard' ? 'Standard (NIP-96)' : 'Custom'}
            </span>
        </div>
        <Button variant="danger" onclick={() => removeMediaServer(server.url)}>Remove</Button>
      </div>
    {/each}

    <div class="flex flex-col gap-2 mt-6 pt-4 border-t border-slate-200">
      <div class="flex gap-2">
        <div class="flex-1">
          <Input bind:value={newMediaServerUrl} placeholder="https://media.server/upload" />
        </div>
        <select bind:value={newMediaProvider} class="border border-slate-200 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-500">
          <option value="standard">Standard (NIP-96)</option>
          <option value="blossom">Blossom (NIP-98)</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <Button onclick={addMediaServer} class="self-end">Add Media Server</Button>
      <p class="text-xs text-slate-400">
        Standard servers use NIP-96 uploads; Blossom servers require NIP-98 signed authorization.
      </p>
    </div>
  </div>
</Card>

<Card title="Zap Wallet">
    <div class="space-y-4">
      {#if walletConfig}
        <div class="flex items-center justify-between gap-4 text-sm text-slate-700">
          <div>
            <p class="font-semibold text-slate-900">{walletConfig.label}</p>
            <p class="text-xs text-slate-500 truncate">{walletConfig.lnurl}</p>
            <p class="text-xs text-slate-500">
              Amount range: {walletConfig.minSendable / 1000}-{walletConfig.maxSendable / 1000} sats
            </p>
          </div>
        <Button variant="secondary" onclick={clearWallet}>Disconnect</Button>
      </div>
    {:else}
      <div class="space-y-2">
        <Input bind:value={lnurlInput} placeholder="lnurl1dp68gurn8ghj7..." />
        <div class="flex gap-2">
          <Button onclick={validateWalletLnurl}>Validate</Button>
          <Button variant="secondary" onclick={saveWallet} disabled={!lnurlInput.trim()}>Save Wallet</Button>
        </div>
        <p class="text-xs text-slate-400">{walletStatus}</p>
        {#if lnurlMetadata}
          <p class="text-xs text-slate-500">Domain: {new URL(lnurlMetadata.callback).hostname}</p>
          <p class="text-xs text-slate-500">Limits: {lnurlMetadata.minSendable / 1000}-{lnurlMetadata.maxSendable / 1000} sats</p>
        {/if}
      </div>
    {/if}
  </div>
</Card>
