<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/authService';
  import { authStore } from '$lib/state/authStore';
  import { walletPreferenceStore } from '$lib/state/walletPreferenceStore';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import Card from '$lib/ui/components/Card.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Nip46LoginModal from '$lib/ui/components/Nip46LoginModal.svelte';

  let showNip46Modal = $state(false);
  let isExtensionConnecting = $state(false);
  let extensionError = $state('');

  onMount(() => {
      if ($authStore.pubkey) {
          goto('/writer');
      }
  });

  async function loginExtension() {
      isExtensionConnecting = true;
      extensionError = '';
      const res = await authService.loginWithNip07();
      isExtensionConnecting = false;
      
      if (res.ok) {
          goto('/writer');
      } else {
          extensionError = res.error.message;
      }
  }

  function handleLoginSuccess(pubkey: string) {
      goto('/writer');
  }

  const walletLabels: Record<'nip07' | 'nip46' | 'external', string> = {
      nip07: 'Browser Extension (NIP-07)',
      nip46: 'Nostr Connect / Remote Signer (NIP-46)',
      external: 'External Lightning Wallet'
  };
</script>

<div class="max-w-2xl mx-auto py-12 px-4">
    <div class="text-center mb-12">
        <div class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg mb-6">
            <Icon name="Books" size={32} />
        </div>
        <SectionHeader title="Welcome to Binder" subtitle="Choose your preferred way to sign events and manage your books." />
        <p class="text-sm text-slate-400 mt-2">
            Preferred wallet flow: <span class="font-semibold text-violet-600">{walletLabels[$walletPreferenceStore]}</span>
        </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- NIP-07 -->
        <div class="flex flex-col h-full">
            <Card>
                <div class="flex flex-col h-full items-center text-center">
                    <div class="p-3 bg-violet-50 text-violet-600 rounded-xl mb-4">
                        <Icon name="PencilSimple" size={28} />
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 mb-2">Browser Extension</h3>
                    <p class="text-sm text-slate-500 mb-8 flex-grow">
                        Use Alby, Nos2x, or any NIP-07 compatible extension. Best for desktop browsers.
                    </p>
                    
                    {#if extensionError}
                        <div class="w-full text-xs text-rose-600 bg-rose-50 p-2 rounded mb-4 border border-rose-100">
                            {extensionError}
                        </div>
                    {/if}

                    <div class="w-full">
                        <Button variant={$walletPreferenceStore === 'nip07' ? 'primary' : 'secondary'} onclick={loginExtension} disabled={isExtensionConnecting} class="w-full">
                            {#if isExtensionConnecting}
                                <Icon name="Pulse" class="animate-spin mr-2" size={16} /> Connecting...
                            {:else}
                                Login with Extension
                            {/if}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>

        <!-- NIP-46 -->
        <div class="flex flex-col h-full">
            <Card>
                <div class="flex flex-col h-full items-center text-center">
                    <div class="p-3 bg-violet-50 text-violet-600 rounded-xl mb-4">
                        <Icon name="Lightning" size={28} />
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 mb-2">Nostr Connect</h3>
                    <p class="text-sm text-slate-500 mb-8 flex-grow">
                        Connect to a remote signer like Amber, Bunker, or a mobile wallet. Works everywhere.
                    </p>
                    <div class="w-full">
                        <Button variant={$walletPreferenceStore === 'nip46' ? 'primary' : 'secondary'} onclick={() => showNip46Modal = true} class="w-full">
                            Login with Bunker
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    </div>

    <div class="text-center mt-12">
        <p class="text-sm text-slate-400">
            Just want to read? <a href="/discover" class="text-violet-600 font-semibold hover:text-violet-700 underline underline-offset-4">Browse as Guest</a>
        </p>
    </div>
</div>

<Nip46LoginModal 
    isOpen={showNip46Modal} 
    onClose={() => showNip46Modal = false} 
    onLogin={handleLoginSuccess}
/>
