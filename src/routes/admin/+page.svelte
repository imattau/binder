<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import Card from '$lib/ui/components/Card.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import Input from '$lib/ui/components/Input.svelte';
  import { authStore } from '$lib/state/authStore';
import { relayDefaultsService } from '$lib/services/relayDefaultsService';
  import { DEFAULT_RELAYS } from '$lib/infra/nostr/pool';
  import { mediaSettingsService, DEFAULT_MEDIA_SERVERS } from '$lib/services/mediaSettingsService';
  import type { RelaySetting, MediaServerSetting } from '$lib/infra/storage/dexieDb';
  import { getStoredAdminPubkey, clearStoredAdminPubkey } from '$lib/services/adminService';
  import { pageConfigService, type PageConfig } from '$lib/services/pageConfigService';
  import { mediaService } from '$lib/services/mediaService';

  let relays: RelaySetting[] = [];
  let mediaServers: MediaServerSetting[] = [];
  let newRelayUrl = '';
  let newMediaUrl = '';
  let newMediaProvider: 'standard' | 'blossom' | 'custom' = 'standard';
  let relayMessage = '';
  let mediaMessage = '';
  let adminPubkey: string | null = null;
  let adminMessage = '';
  let isSavingRelays = false;
  let isSavingMedia = false;
  let pageConfig = pageConfigService.getConfig();
  let coverInput: HTMLInputElement | null = null;
  let iconInput: HTMLInputElement | null = null;
  let isUploadingCover = false;
  let isUploadingIcon = false;
  let coverMessage = '';
  let iconMessage = '';

  const layoutInfo = [
    { label: 'Default Relays', description: 'These relays are used by default when no user-specific list is available.' },
    { label: 'Media Servers', description: 'Media uploads flow through these endpoints by default.' }
  ];

  function updateAdminIndicator() {
    adminPubkey = getStoredAdminPubkey();
  }

  async function refreshRelays() {
    const res = await relayDefaultsService.getDefaults();
    relays = res.ok && res.value.length ? res.value : DEFAULT_RELAYS.map(url => ({ url, enabled: true }));
  }

  async function refreshMediaServers() {
    const res = await mediaSettingsService.getMediaServers();
    mediaServers = res.ok && res.value.length ? res.value : DEFAULT_MEDIA_SERVERS;
  }

  async function addRelay() {
    if (!newRelayUrl.trim()) return;
    isSavingRelays = true;
    relayMessage = '';
    const updated = [...relays, { url: newRelayUrl.trim(), enabled: true }];
    const res = await relayDefaultsService.setDefaults(updated);
    isSavingRelays = false;
    if (res.ok) {
      newRelayUrl = '';
      relayMessage = 'Relay saved.';
      await refreshRelays();
    } else {
      relayMessage = res.error.message;
    }
  }

  async function toggleRelay(index: number) {
    const updated = [...relays];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    const res = await relayDefaultsService.setDefaults(updated);
    if (res.ok) {
      relayMessage = 'Relay list updated.';
      await refreshRelays();
    } else {
      relayMessage = res.error.message;
    }
  }

  async function resetRelays() {
    isSavingRelays = true;
    relayMessage = '';
    const res = await relayDefaultsService.resetToDefaults();
    isSavingRelays = false;
    if (res.ok) {
      relayMessage = 'Defaults restored.';
      await refreshRelays();
    } else {
      relayMessage = res.error.message;
    }
  }

  async function addMediaServer() {
    if (!newMediaUrl.trim()) return;
    isSavingMedia = true;
    mediaMessage = '';
    const updated = [...mediaServers, { url: newMediaUrl.trim(), enabled: true, provider: newMediaProvider }];
    const res = await mediaSettingsService.setMediaServers(updated);
    isSavingMedia = false;
    if (res.ok) {
      newMediaUrl = '';
      mediaMessage = 'Media server saved.';
      await refreshMediaServers();
    } else {
      mediaMessage = res.error.message;
    }
  }

  async function toggleMedia(index: number) {
    const updated = [...mediaServers];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    const res = await mediaSettingsService.setMediaServers(updated);
    if (res.ok) {
      mediaMessage = 'Media servers updated.';
      await refreshMediaServers();
    } else {
      mediaMessage = res.error.message;
    }
  }

  async function resetMediaServers() {
    isSavingMedia = true;
    mediaMessage = '';
    const res = await mediaSettingsService.resetToDefaults();
    isSavingMedia = false;
    if (res.ok) {
      mediaMessage = 'Media defaults restored.';
      await refreshMediaServers();
    } else {
      mediaMessage = res.error.message;
    }
  }
  
  async function uploadPageAsset(type: 'cover' | 'icon') {
    const input = type === 'cover' ? coverInput : iconInput;
    if (!input?.files?.[0]) return;
    const file = input.files[0];
    if (type === 'cover') {
      isUploadingCover = true;
      coverMessage = '';
    } else {
      isUploadingIcon = true;
      iconMessage = '';
    }
    try {
      const res = await mediaService.uploadImage(file);
      if (res.ok) {
        const updatedConfig = { ...pageConfig, [`${type}Image`]: res.value };
        pageConfig = updatedConfig;
        pageConfigService.saveConfig(updatedConfig);
        if (type === 'cover') {
          coverMessage = 'Cover saved.';
        } else {
          iconMessage = 'Icon saved.';
        }
      } else {
        if (type === 'cover') coverMessage = res.error.message;
        else iconMessage = res.error.message;
      }
    } catch (e: any) {
      const message = e?.message || 'Upload failed';
      if (type === 'cover') coverMessage = message;
      else iconMessage = message;
    } finally {
      if (type === 'cover') {
        isUploadingCover = false;
        if (input) input.value = '';
      } else {
        isUploadingIcon = false;
        if (input) input.value = '';
      }
    }
  }

  function resetAdminAssignment() {
    clearStoredAdminPubkey();
    updateAdminIndicator();
    adminMessage = 'Admin reset. Next local login will claim ownership.';
  }

  onMount(async () => {
    const session = get(authStore);
    if (!session.isAdmin) {
      goto('/writer');
      return;
    }
    updateAdminIndicator();
    await refreshRelays();
    await refreshMediaServers();
  });
</script>

<div class="px-4 py-10 max-w-5xl mx-auto space-y-6">
  <Card>
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase text-slate-400 tracking-[0.3em]">Admin Console</p>
          <h1 class="text-2xl font-semibold text-slate-900">Site Configuration</h1>
        </div>
        <div class="text-right text-xs text-slate-500">
          <p>Current admin</p>
          <p class="font-mono text-[10px] text-slate-700">{adminPubkey ?? 'unassigned'}</p>
        </div>
      </div>
      <div class="text-xs text-slate-500">
        Only the first signer to authenticate from the local network becomes admin. You can drop the badge below.
      </div>
      <div class="flex gap-2">
        <Button variant="secondary" onclick={resetAdminAssignment}>Reset Admin</Button>
        {#if adminMessage}
          <span class="text-xs text-emerald-600">{adminMessage}</span>
        {/if}
      </div>
    </div>
  </Card>

  <Card>
    <div class="flex items-center justify-between mb-4">
      <div>
        <p class="text-xs uppercase text-slate-400">{layoutInfo[0].label}</p>
        <h2 class="text-lg font-semibold text-slate-900">Default Relays</h2>
        <p class="text-xs text-slate-500">{layoutInfo[0].description}</p>
      </div>
    </div>
    <div class="space-y-3">
      {#if relays.length}
        {#each relays as relay, index}
          <div class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div>
              <p class="font-semibold text-slate-900">{relay.url}</p>
              <p class="text-xs text-slate-500">{relay.enabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <Button size="sm" variant="ghost" onclick={() => toggleRelay(index)}>
              {relay.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        {/each}
      {:else}
        <p class="text-xs text-slate-500">No relays configured yet.</p>
      {/if}
    </div>
    <div class="mt-4 space-y-3">
      <div class="flex gap-2">
        <Input bind:value={newRelayUrl} placeholder="wss://example.relay" />
        <Button
          variant="primary"
          disabled={!newRelayUrl.trim() || isSavingRelays}
          onclick={addRelay}
        >
          Add Relay
        </Button>
        <Button variant="secondary" disabled={isSavingRelays} onclick={resetRelays}>
          Reset to Defaults
        </Button>
      </div>
      {#if relayMessage}
        <p class="text-xs text-emerald-600">{relayMessage}</p>
      {/if}
    </div>
  </Card>

  <Card>
    <div class="flex items-center justify-between mb-4">
      <div>
        <p class="text-xs uppercase text-slate-400">{layoutInfo[1].label}</p>
        <h2 class="text-lg font-semibold text-slate-900">Media Servers</h2>
        <p class="text-xs text-slate-500">{layoutInfo[1].description}</p>
      </div>
    </div>
    <div class="space-y-3">
      {#if mediaServers.length}
        {#each mediaServers as server, index}
          <div class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div>
              <p class="font-semibold text-slate-900">{server.url}</p>
              <p class="text-xs text-slate-500">
                {server.provider} • {server.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Button size="sm" variant="ghost" onclick={() => toggleMedia(index)}>
              {server.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        {/each}
      {:else}
        <p class="text-xs text-slate-500">No media servers configured yet.</p>
      {/if}
    </div>
    <div class="mt-4 space-y-3">
      <div class="flex flex-wrap gap-2">
        <Input bind:value={newMediaUrl} placeholder="https://cdn.example.net" />
        <select
          class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          bind:value={newMediaProvider}
        >
          <option value="standard">Standard</option>
          <option value="blossom">Blossom</option>
          <option value="custom">Custom</option>
        </select>
        <Button
          variant="primary"
          disabled={!newMediaUrl.trim() || isSavingMedia}
          onclick={addMediaServer}
        >
          Add Server
        </Button>
        <Button variant="secondary" disabled={isSavingMedia} onclick={resetMediaServers}>
          Reset to Defaults
        </Button>
      </div>
      {#if mediaMessage}
        <p class="text-xs text-emerald-600">{mediaMessage}</p>
      {/if}
    </div>
  </Card>

  <Card>
    <div class="flex items-center justify-between mb-4">
      <div>
        <p class="text-xs uppercase text-slate-400">Site Imagery</p>
        <h2 class="text-lg font-semibold text-slate-900">Page Cover & Icon</h2>
        <p class="text-xs text-slate-500">Upload visuals used for the public portal (hero cover or favicon slot).</p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="text-xs px-3 py-1 rounded bg-slate-900 text-white transition"
          onclick={() => coverInput?.click()}
          disabled={isUploadingCover}
        >
          {isUploadingCover ? 'Uploading...' : 'Upload Cover'}
        </button>
        <button
          type="button"
          class="text-xs px-3 py-1 rounded bg-slate-900 text-white transition"
          onclick={() => iconInput?.click()}
          disabled={isUploadingIcon}
        >
          {isUploadingIcon ? 'Uploading...' : 'Upload Icon'}
        </button>
      </div>
    </div>
    <input type="file" accept="image/*" class="hidden" bind:this={coverInput} onchange={() => uploadPageAsset('cover')} />
    <input type="file" accept="image/*" class="hidden" bind:this={iconInput} onchange={() => uploadPageAsset('icon')} />
    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-2">
        <p class="text-xs text-slate-500">Current Cover</p>
        {#if pageConfig.coverImage}
          <img src={pageConfig.coverImage} alt="Cover preview" class="w-full h-48 object-cover rounded" />
        {:else}
          <div class="h-48 rounded bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs uppercase tracking-wide text-slate-400">
            No cover uploaded
          </div>
        {/if}
        {#if coverMessage}
          <p class="text-xs text-emerald-600">{coverMessage}</p>
        {/if}
      </div>
      <div class="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-2">
        <p class="text-xs text-slate-500">Current Icon</p>
        {#if pageConfig.iconImage}
          <img src={pageConfig.iconImage} alt="Icon preview" class="w-24 h-24 object-cover rounded-full border border-slate-200" />
        {:else}
          <div class="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-xs uppercase tracking-wide text-slate-400">
            No icon
          </div>
        {/if}
        {#if iconMessage}
          <p class="text-xs text-emerald-600">{iconMessage}</p>
        {/if}
      </div>
    </div>
  </Card>
</div>
