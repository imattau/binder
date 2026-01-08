<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/state/authStore';
  import { settingsStore } from '$lib/state/settingsStore';
  import { mediaSettingsStore } from '$lib/state/mediaSettingsStore';
  import { themeStore, type ThemePreference } from '$lib/state/themeStore';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import Card from '$lib/ui/components/Card.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import Input from '$lib/ui/components/Input.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import type { MediaServerSetting } from '$lib/infra/storage/dexieDb';
  import { schemaService } from '$lib/services/schemaService';

  let newRelayUrl = $state('');
  let newMediaServerUrl = $state('');
  let newMediaProvider = $state<MediaServerSetting['provider']>('standard');
  const themeOptions: { label: string; description: string; value: ThemePreference }[] = [
      {
          label: 'Auto (follow system)',
          description: 'Binder mirrors your OS preference.',
          value: 'auto'
      },
      {
          label: 'Light',
          description: 'Always use the light background palette.',
          value: 'light'
      },
      {
          label: 'Dark',
          description: 'Force the charcoal dark theme.',
          value: 'dark'
      }
  ];

  function selectTheme(value: ThemePreference) {
      themeStore.setTheme(value);
  }

  $effect(() => {
      if (!$authStore.pubkey) {
          goto('/login');
      }
  });

  onMount(() => {
    if ($authStore.pubkey) {
        settingsStore.load();
        mediaSettingsStore.load();
    }
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

  const schemaInfo = schemaService.getCurrentSchema();
  let schemaCopied = $state(false);

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

  async function copySchemaAnnouncement() {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return;
      const payload = JSON.stringify(schemaService.buildAnnouncement(), null, 2);
      try {
          await navigator.clipboard.writeText(payload);
          schemaCopied = true;
          setTimeout(() => {
              schemaCopied = false;
          }, 2000);
      } catch (err) {
          console.error('Unable to copy schema event', err);
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

<Card title="Appearance">
  <div class="space-y-4">
      <div class="flex flex-wrap gap-3">
          {#each themeOptions as option}
              <div class="flex flex-col gap-2">
                  <Button
                      variant={$themeStore === option.value ? 'primary' : 'secondary'}
                      size="sm"
                      onclick={() => selectTheme(option.value)}
                  >
                      {option.label}
                  </Button>
                  <p class="text-xs text-slate-500">{option.description}</p>
              </div>
          {/each}
      </div>
      <p class="text-xs text-slate-400">
        Current preference: <span class="font-semibold">{($themeStore === 'auto' ? 'Auto (system)' : $themeStore)}</span>
      </p>
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

<Card title="Binder Schema">
  <div class="space-y-3">
    <p class="text-sm text-slate-600">
      Version <span class="font-semibold">{schemaInfo.version}</span> · Hash <span class="font-mono text-xs">{schemaInfo.hash}</span>
    </p>
    <p class="text-xs text-slate-500">
      Schema reference: <a href={schemaInfo.url} target="_blank" rel="noreferrer" class="text-violet-600 hover:underline">View docs/binder-schema.md</a>
    </p>
    <div class="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onclick={copySchemaAnnouncement}>
        <div class="flex items-center gap-2">
          <Icon name="FileText" />
          Copy schema event
        </div>
      </Button>
      <a
        href={schemaInfo.url}
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        <Icon name="ArrowRight" />
        Open schema doc
      </a>
    </div>
    {#if schemaCopied}
      <p class="text-xs text-emerald-500">Schema event JSON copied to clipboard.</p>
    {/if}
  </div>
</Card>
