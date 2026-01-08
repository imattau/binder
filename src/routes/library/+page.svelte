<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/state/authStore';
  import { libraryStore } from '$lib/state/libraryStore';
  import { bookLayoutStore } from '$lib/state/bookLayoutStore';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import LayoutToggle from '$lib/ui/components/LayoutToggle.svelte';
  import BookCard from '$lib/ui/components/discovery/BookCard.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Tabs from '$lib/ui/components/Tabs.svelte';
  import ListRow from '$lib/ui/components/ListRow.svelte';
  import { formatDistanceToNow } from 'date-fns';

  let activeShelfId = $state('favorites');

  $effect(() => {
      if (!$authStore.pubkey) {
          goto('/login');
      }
  });

  onMount(() => {
    if ($authStore.pubkey) {
        libraryStore.load();
    }
  });

  const activeBooks = $derived($libraryStore.books.filter(b => b.shelves.includes(activeShelfId)));
  
  function toFeedItem(book: any): any {
      return {
          event: {
              tags: [
                  ['title', book.title],
                  ...(book.coverUrl ? [['cover', book.coverUrl]] : []),
                  ['d', book.d],
                  ['summary', book.summary || '']
              ],
              pubkey: book.pubkey,
              created_at: Math.floor(book.addedAt / 1000),
              content: ''
          },
          type: 'book',
          reason: 'Saved'
      };
  }

  async function handleCreateShelf() {
      const name = typeof window !== 'undefined' ? window.prompt('Shelf name:') : null;
      if (!name) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const res = await libraryStore.createShelf(trimmed);
      if (res.ok) {
          activeShelfId = res.value.id;
      }
  }
</script>

  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="My Library" subtitle="Your saved books and shelves" />
        <div class="flex items-center gap-3">
          <LayoutToggle />
          {#if $authStore.pubkey}
            <Button onclick={handleCreateShelf}>
                <div class="flex items-center gap-2">
                    <Icon name="Plus" /> New Shelf
                </div>
            </Button>
          {/if}
        </div>
    </div>

  <Tabs 
      items={$libraryStore.shelves.map(s => ({ id: s.id, label: s.name }))}
      activeItem={activeShelfId}
      onchange={(id: string) => activeShelfId = id}
  />

  {#if activeBooks.length === 0}
      <div class="text-center py-12 bg-slate-50 rounded-lg text-slate-500 border border-slate-100">
          <Icon name="BookOpen" size={48} class="mx-auto mb-4 text-slate-300" />
          <p>No books in this shelf.</p>
          <a href="/discover" class="text-violet-600 hover:underline mt-2 inline-block">Discover books</a>
      </div>
  {:else}
      {#if $bookLayoutStore === 'grid'}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each activeBooks as book}
                  <div class="relative group">
                      <BookCard item={toFeedItem(book)} />
                      <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                              class="bg-white p-1 rounded-full shadow-md text-slate-400 hover:text-red-500"
                              onclick={(e) => { e.stopPropagation(); libraryStore.toggleShelf(book, activeShelfId); }}
                              title="Remove from shelf"
                          >
                              <Icon name="Trash" size={16} />
                          </button>
                      </div>
                  </div>
              {/each}
          </div>
      {:else}
          <div class="space-y-2">
              {#each activeBooks as book}
                  <ListRow
                      icon="BookOpen"
                      coverUrl={book.coverUrl}
                      title={book.title}
                      subtitle={`Added ${formatDistanceToNow(new Date(book.addedAt), { addSuffix: true })}`}
                      onclick={() => goto(`/read/${book.id}`)}
                  >
                      {#snippet actions()}
                          <button
                              class="p-1 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                              onclick={(e) => { e.stopPropagation(); libraryStore.toggleShelf(book, activeShelfId); }}
                              title="Remove from shelf"
                              aria-label="Remove from shelf"
                          >
                              <Icon name="Trash" size={16} />
                          </button>
                      {/snippet}
                  </ListRow>
              {/each}
          </div>
      {/if}
  {/if}
</div>
