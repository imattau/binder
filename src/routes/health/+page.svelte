<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/state/authStore';
  import { healthStore } from '$lib/state/healthStore';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import Card from '$lib/ui/components/Card.svelte';
  import Badge from '$lib/ui/components/Badge.svelte';
  import Button from '$lib/ui/components/Button.svelte';

  $effect(() => {
      if (!$authStore.pubkey) {
          goto('/login');
      }
  });

  onMount(() => {
    if ($authStore.pubkey) {
        healthStore.refresh();
    }
  });
</script>

<SectionHeader title="System Diagnostics" subtitle="Check the health of your Binder instance" />

{#if $healthStore}
  <div class="space-y-6">
    <!-- App Info -->
    <Card title="Application">
      <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <div class="flex justify-between">
          <dt class="text-sm font-medium text-slate-500">Version</dt>
          <dd class="text-sm text-slate-900">{$healthStore.app.version}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-sm font-medium text-slate-500">Mode</dt>
          <dd class="text-sm text-slate-900">{$healthStore.app.mode}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-sm font-medium text-slate-500">PWA Support</dt>
          <dd>
            <Badge status={$healthStore.app.pwa ? 'success' : 'warning'} label={$healthStore.app.pwa ? 'Active' : 'Unavailable'} />
          </dd>
        </div>
      </dl>
    </Card>

    <!-- Signer -->
    <Card title="Signer">
      <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <div class="flex justify-between">
          <dt class="text-sm font-medium text-slate-500">NIP-07 Extension</dt>
          <dd>
            <Badge status={$healthStore.signer.nip07 ? 'success' : 'error'} label={$healthStore.signer.nip07 ? 'Detected' : 'Not Found'} />
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-sm font-medium text-slate-500">NIP-46 Connect</dt>
          <dd>
            <Badge status={$healthStore.signer.nip46 ? 'success' : 'neutral'} label={$healthStore.signer.nip46 ? 'Connected' : 'Not Configured'} />
          </dd>
        </div>
      </dl>
    </Card>

    <!-- Storage -->
    <Card title="Storage">
      <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <div class="flex justify-between">
          <dt class="text-sm font-medium text-slate-500">IndexedDB</dt>
          <dd>
            <Badge status={$healthStore.storage.indexedDb ? 'success' : 'error'} label={$healthStore.storage.indexedDb ? 'OK' : 'Failed'} />
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-sm font-medium text-slate-500">Settings Loaded</dt>
          <dd>
            <Badge status={$healthStore.storage.settingsLoaded ? 'success' : 'error'} label={$healthStore.storage.settingsLoaded ? 'Yes' : 'No'} />
          </dd>
        </div>
      </dl>
    </Card>

    <!-- Relays -->
    <Card title="Relay Connectivity">
      {#if $healthStore.relays.length === 0}
        <p class="text-sm text-slate-500">No relays configured.</p>
      {:else}
        <div class="space-y-4">
          {#each $healthStore.relays as relay}
            <div class="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <span class="text-sm font-mono text-slate-600 truncate mr-4">{relay.url}</span>
              <div class="flex items-center gap-2">
                {#if relay.ok}
                  <span class="text-xs text-slate-400">{relay.latency}ms</span>
                  <Badge status="success" label="OK" />
                {:else}
                  <span class="text-xs text-rose-500">{relay.error}</span>
                  <Badge status="error" label="Fail" />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    <div class="flex justify-end">
        <Button onclick={() => healthStore.refresh()}>Refresh Diagnostics</Button>
    </div>
  </div>
{:else}
  <div class="text-center py-12">
    <p class="text-slate-500">Loading diagnostics...</p>
  </div>
{/if}
