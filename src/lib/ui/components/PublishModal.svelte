<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import Badge from './Badge.svelte';
  import type { PublishResult } from '$lib/services/publisherService';

  let { 
    isOpen, 
    isPublishing,
    results, 
    error,
    onConfirm, 
    onClose 
  } = $props();

  let step = $state(0); 

  $effect(() => {
      if (isOpen && !isPublishing && !results && !error) {
          step = 0; // Reset
      }
      if (isPublishing) step = 1;
      if (results || error) step = 2;
  });
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-medium text-gray-900">Publish to Nostr</h3>
        <button onclick={onClose} class="text-gray-400 hover:text-gray-500">
            <Icon name="X" size={24} />
        </button>
      </div>

      <div class="space-y-6">
        <!-- Steps -->
        <div class="flex items-center justify-between text-sm">
            <div class="flex flex-col items-center {step >= 0 ? 'text-indigo-600' : 'text-gray-400'}">
                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1 {step >= 0 ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}">1</div>
                <span>Review</span>
            </div>
            <div class="h-0.5 flex-1 bg-gray-200 mx-4"></div>
            <div class="flex flex-col items-center {step >= 1 ? 'text-indigo-600' : 'text-gray-400'}">
                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1 {step >= 1 ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}">2</div>
                <span>Publish</span>
            </div>
            <div class="h-0.5 flex-1 bg-gray-200 mx-4"></div>
            <div class="flex flex-col items-center {step >= 2 ? 'text-indigo-600' : 'text-gray-400'}">
                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1 {step >= 2 ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}">3</div>
                <span>Done</span>
            </div>
        </div>

        <!-- Content -->
        <div class="min-h-[150px]">
            {#if step === 0}
                <p class="text-gray-600 mb-4">
                    You are about to publish this book and its chapters to the configured relays.
                    This will create permanent events on the Nostr network.
                </p>
                <div class="bg-yellow-50 p-4 rounded-md flex gap-3">
                    <Icon name="CloudWarning" class="text-yellow-600 shrink-0" size={24} />
                    <p class="text-sm text-yellow-700">
                        Ensure your NIP-07 extension is active. You will be asked to sign multiple events.
                    </p>
                </div>
            {:else if step === 1}
                 <div class="flex flex-col items-center justify-center py-8 gap-4">
                     <Icon name="Pulse" size={48} class="text-indigo-600 animate-spin" />
                     <p class="text-gray-600">Signing and publishing to relays...</p>
                 </div>
            {:else if step === 2}
                 {#if error}
                    <div class="bg-red-50 p-4 rounded-md flex gap-3">
                        <Icon name="X" class="text-red-600 shrink-0" size={24} />
                        <div>
                            <h4 class="text-sm font-medium text-red-800">Publishing Failed</h4>
                            <p class="text-sm text-red-700 mt-1">{error.message}</p>
                        </div>
                    </div>
                 {:else if results}
                    <div class="text-center mb-4">
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <Icon name="CheckCircle" class="text-green-600" size={24} />
                        </div>
                        <h4 class="text-lg font-medium text-gray-900">Successfully Published!</h4>
                        <p class="text-sm text-gray-500">Your book is now live on Nostr.</p>
                    </div>
                    
                    <div class="bg-gray-50 rounded-md p-4 max-h-40 overflow-y-auto text-xs font-mono space-y-1">
                        {#each results as res}
                             <div class="flex justify-between">
                                 <span class="truncate max-w-[200px]">Kind {res.event.kind}</span>
                                 <span class="text-green-600">
                                     {Object.values(res.relays).filter(Boolean).length} / {Object.keys(res.relays).length} relays
                                 </span>
                             </div>
                        {/each}
                    </div>
                 {/if}
            {/if}
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
            {#if step === 0}
                <Button variant="secondary" onclick={onClose}>Cancel</Button>
                <Button onclick={onConfirm}>Confirm & Publish</Button>
            {:else if step === 2}
                <Button onclick={onClose}>Close</Button>
            {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
