<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import AppShell from '$lib/ui/components/AppShell.svelte';
  import { authStore } from '$lib/state/authStore';
  import { settingsService } from '$lib/services/settingsService';
  import { profileService } from '$lib/services/profileService';

  onMount(async () => {
      const session = authStore.loadSession();
      if (session?.pubkey) {
          // Sync relays in background on load
          settingsService.syncRelaysFromNetwork(session.pubkey);
          if (!session.profile?.name && !session.profile?.picture) {
              const profileRes = await profileService.loadProfile(session.pubkey);
              if (profileRes.ok) {
                  authStore.updateProfile(profileRes.value);
              }
          }
      }
  });
</script>

<AppShell>
  <slot />
</AppShell>
