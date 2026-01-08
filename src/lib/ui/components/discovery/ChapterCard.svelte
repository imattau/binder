<script lang="ts">
  import Icon from '../Icon.svelte';
  import ReasonLine from './ReasonLine.svelte';
  import type { FeedItem } from '$lib/domain/types';
  import { goto } from '$app/navigation';
  import { formatDistanceToNow } from 'date-fns';
  import { getSocialCounts, type SocialCounts } from '$lib/services/socialCountService';
  import { onMount } from 'svelte';

  let { item }: { item: FeedItem } = $props();
  const e = $derived(item.event);
  const title = $derived(e.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Chapter');
  
  // Resolve Book Coordinate
  const bookTag = $derived(e.tags.find(t => t[0] === 'book'));
  const bookD = $derived(bookTag ? bookTag[1] : '');
  // Assume same author if not specified (standard binder flow)
  // If bookTag has 3 parts (address), use it. Else construct.
  const bookCoord = $derived(bookD.includes(':') ? bookD : `30003:${e.pubkey}:${bookD}`);

  // Chapter Coordinate
  const d = $derived(e.tags.find(t => t[0] === 'd')?.[1]);
  const chapterCoord = $derived(`30023:${e.pubkey}:${d}`);
  const chapterD = d || '';
  const coord = { kind: 30023, pubkey: e.pubkey, d: chapterD };
  let stats: SocialCounts = { likes: 0, comments: 0, boosts: 0, zaps: 0 };
  let statsLoading = $state(true);

  onMount(async () => {
      try {
          const res = await getSocialCounts(coord);
          if (res.ok) {
              stats = res.value;
          }
      } finally {
          statsLoading = false;
      }
  });
  
  const addedAt = $derived(new Date(e.created_at * 1000));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="group block rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:border-violet-100 hover:shadow-md cursor-pointer"
  onclick={() => goto(`/read/${bookCoord}/${chapterCoord}`)}
>
  <ReasonLine reason={item.reason} />
  
  <div class="flex gap-4">
      <div class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-violet-50 group-hover:text-violet-600 transition-colors">
          <Icon name="FileText" size={20} />
      </div>
      <div class="min-w-0 flex-1">
          <h4 class="font-semibold text-slate-900 group-hover:text-violet-700 transition-colors truncate">{title}</h4>
          <p class="mt-1 text-sm text-slate-500 line-clamp-2 leading-relaxed">{e.content.slice(0, 150)}...</p>
          
          <div class="mt-2 flex items-center gap-2 text-xs font-medium text-slate-400">
               <span>{e.pubkey.slice(0, 6)}...</span>
               <span class="text-slate-300">•</span>
               <span>{formatDistanceToNow(addedAt)} ago</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
              <div class="flex items-center gap-1">
                  <Icon name="Heart" size={14} class="text-rose-500" />
                  <span>{statsLoading ? '...' : stats.likes}</span>
              </div>
              <div class="flex items-center gap-1">
                  <Icon name="ChatCircle" size={14} class="text-slate-500" />
                  <span>{statsLoading ? '...' : stats.comments}</span>
              </div>
              <div class="flex items-center gap-1">
                  <Icon name="ArrowsClockwise" size={14} class="text-amber-500" />
                  <span>{statsLoading ? '...' : stats.boosts}</span>
              </div>
              <div class="flex items-center gap-1">
                  <Icon name="Lightning" size={14} class="text-yellow-500" />
                  <span>{statsLoading ? '...' : stats.zaps}</span>
              </div>
          </div>
      </div>
  </div>
</div>
