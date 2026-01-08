<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import '../app.css';
  import AppShell from '$lib/ui/components/AppShell.svelte';
  import { authStore } from '$lib/state/authStore';
  import { settingsService } from '$lib/services/settingsService';
  import { profileService } from '$lib/services/profileService';
  import { themeStore } from '$lib/state/themeStore';
  import { pageConfigStore } from '$lib/state/pageConfigStore';
  import ZapModal from '$lib/ui/components/ZapModal.svelte';
  import { zapModalStore } from '$lib/state/zapModalStore';

  let { children } = $props();
  
  let zapState = $state({ open: false, target: undefined as any, name: undefined as string | undefined });

  onMount(async () => {
      zapModalStore.subscribe(state => {
        zapState.open = state.open;
        zapState.target = state.target;
        zapState.name = state.name;
      });

      const session = authStore.loadSession();
      if (session?.pubkey) {
          // Sync relays in background on load
          settingsService.syncRelaysFromNetwork(session.pubkey);
          pageConfigStore.loadFromNetwork(session.pubkey);
          
          if (!session.profile?.name && !session.profile?.picture) {
              const profileRes = await profileService.loadProfile(session.pubkey);
              if (profileRes.ok) {
                  authStore.updateProfile(profileRes.value);
              }
          }
      }
  });

  const themeUnsub = themeStore.subscribe(() => {});
  onDestroy(() => themeUnsub());
</script>

<AppShell>
  {@render children()}
</AppShell>

<ZapModal 
  bind:open={zapState.open} 
  target={zapState.target} 
  name={zapState.name} 
/>
