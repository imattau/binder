<svelte:options runes={false} />
<script lang="ts">
  import type { GroupedFeedItem } from '$lib/domain/types';
  import type { BookLayoutMode } from '$lib/state/bookLayoutStore';
  import ChapterCard from './ChapterCard.svelte';
  import Icon from '../Icon.svelte';
  import Button from '../Button.svelte';
  import { zapModalStore } from '$lib/state/zapModalStore';

  export let group: GroupedFeedItem;
  export let layoutMode: BookLayoutMode = 'list';
  const author = group.author;
  const displayName = author.displayName || author.name || author.pubkey.slice(0, 8);
  $: isGridMode = layoutMode === 'grid';
  $: chapterContainerClass = isGridMode ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3';

  function handleZap() {
    zapModalStore.open({
      type: 'profile',
      pubkey: author.pubkey
    }, displayName);
  }
</script>

<div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
  <!-- Author Header -->
  <div class="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
          {#if author.picture}
              <img src={author.picture} alt={displayName} class="w-10 h-10 rounded-full object-cover shadow-sm bg-white" />
          {:else}
              <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 shadow-sm">
                  <Icon name="PencilSimple" size={20} />
              </div>
          {/if}
          
          <div>
              <h3 class="font-bold text-slate-900 leading-tight">{displayName}</h3>
              {#if author.nip05}
                  <p class="text-xs text-slate-500">{author.nip05}</p>
              {/if}
          </div>
      </div>

      <Button variant="secondary" class="h-8 px-3 text-xs" onclick={handleZap}>
          <div class="flex items-center gap-1.5">
              <Icon name="Lightning" size={14} weight="fill" class="text-amber-500" />
              Zap
          </div>
      </Button>
  </div>

  <!-- Chapters List -->
  <div class={`p-4 ${chapterContainerClass}`}>
      {#each group.chapters as item}
          <ChapterCard {item} />
      {/each}
  </div>
</div>
