<script lang="ts">
  import { onMount } from 'svelte';
  import { offlineRepo } from '$lib/infra/storage/offlineRepo';
  import { db } from '$lib/infra/storage/dexieDb';
  import { goto } from '$app/navigation';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import ListRow from '$lib/ui/components/ListRow.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Badge from '$lib/ui/components/Badge.svelte';
  import type { PublishedBook } from '$lib/domain/types';

  let offlineBooks = $state<PublishedBook[]>([]);
  let loading = $state(true);

  onMount(async () => {
      // Direct Dexie query for 'pinned' index if we added it, or filter
      // offlineRepo doesn't expose getPinnedBooks yet, let's add filtering here or update repo.
      // For now, raw query via db or repo filtering.
      const allBooks = await db.publishedBooks.where('pinned').equals(1).toArray();
      offlineBooks = allBooks;
      loading = false;
  });
</script>

<SectionHeader title="Offline Library" subtitle="Books available without internet connection" />

{#if loading}
    <div class="text-center py-12 text-gray-500">Loading offline books...</div>
{:else if offlineBooks.length === 0}
    <div class="text-center py-12 bg-gray-50 rounded-lg text-gray-500">
        <Icon name="CloudSlash" size={48} class="mx-auto mb-4 text-gray-300" />
        <p>No books pinned for offline reading.</p>
        <a href="/library" class="text-indigo-600 hover:underline mt-2 inline-block">Go to Library</a>
    </div>
{:else}
    <div class="space-y-4">
        {#each offlineBooks as book}
            {@const title = book.bookEvent.tags.find(t => t[0] === 'title')?.[1] || 'Untitled'}
            <ListRow 
                icon="BookOpen" 
                title={title} 
                subtitle="{book.chapterRefs.length} chapters • Cached {new Date(book.cachedAt).toLocaleDateString()}"
                onclick={() => goto(`/read/${book.bookD}`)} 
            >
                {#snippet actions()}
                    <Badge status="success" label="Downloaded" />
                {/snippet}
            </ListRow>
        {/each}
    </div>
{/if}
