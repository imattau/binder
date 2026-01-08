<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { tagsStore } from '$lib/state/tagsStore';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import BookCard from '$lib/ui/components/discovery/BookCard.svelte';
  import ChapterCard from '$lib/ui/components/discovery/ChapterCard.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';

  const tag = $page.params.tag;

  onMount(() => {
    tagsStore.load(tag || '');
  });
</script>

<div class="space-y-8">
  <div class="flex items-center gap-2 mb-6">
       <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-500">
           <span class="text-xl font-bold">#</span>
       </div>
       <div>
           <h1 class="text-3xl font-bold text-gray-900 capitalize">{tag}</h1>
           <p class="text-gray-500">Books and chapters tagged with #{tag}</p>
       </div>
  </div>
  
  {#if $tagsStore.loading}
      <div class="text-center py-12 text-gray-500">Loading tag feed...</div>
  {:else}
      {#if $tagsStore.books.length > 0}
          <section>
              <h2 class="text-lg font-bold text-gray-900 mb-4">Books</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {#each $tagsStore.books as item}
                      <BookCard {item} />
                  {/each}
              </div>
          </section>
      {/if}

      {#if $tagsStore.chapters.length > 0}
          <section>
              <h2 class="text-lg font-bold text-gray-900 mb-4">Chapters</h2>
              <div class="space-y-4">
                  {#each $tagsStore.chapters as item}
                      <ChapterCard {item} />
                  {/each}
              </div>
          </section>
      {/if}
      
      {#if $tagsStore.books.length === 0 && $tagsStore.chapters.length === 0}
           <div class="text-center py-12 bg-gray-50 rounded-lg text-gray-500">
               No content found for #{tag}.
           </div>
      {/if}
  {/if}
</div>
