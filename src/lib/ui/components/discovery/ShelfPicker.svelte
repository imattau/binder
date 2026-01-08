<script lang="ts">
  import { libraryStore } from '$lib/state/libraryStore';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';
  import type { SavedBook } from '$lib/domain/types';

  let { book, onClose }: { book: SavedBook, onClose: () => void } = $props();
  let newShelfName = $state('');

  function toggle(shelfId: string) {
      libraryStore.toggleShelf(book, shelfId);
  }
  
  async function createShelf() {
      if (!newShelfName.trim()) return;
      await libraryStore.createShelf(newShelfName);
      newShelfName = '';
  }
</script>

<div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-gray-900">Add to Shelf</h3>
            <button onclick={onClose}><Icon name="X" /></button>
        </div>
        
        <div class="space-y-2 mb-4">
            {#each $libraryStore.shelves as shelf}
                <button 
                    class="w-full flex items-center justify-between p-3 rounded-md border text-left
                           {book.shelves.includes(shelf.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700'}"
                    onclick={() => toggle(shelf.id)}
                >
                    <span>{shelf.name}</span>
                    {#if book.shelves.includes(shelf.id)}
                        <Icon name="CheckCircle" size={16} />
                    {/if}
                </button>
            {/each}
        </div>
        
        <div class="flex gap-2 border-t pt-4">
            <input 
                class="flex-1 border border-gray-300 rounded-md px-2 text-sm" 
                placeholder="New shelf name..."
                bind:value={newShelfName}
            />
            <Button onclick={createShelf} disabled={!newShelfName.trim()}>Create</Button>
        </div>
    </div>
</div>