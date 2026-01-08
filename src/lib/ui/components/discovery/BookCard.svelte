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
  const title = $derived(e.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Book');
  const summary = $derived(e.tags.find(t => t[0] === 'summary')?.[1]);
  const addedAt = $derived(new Date(e.created_at * 1000));
  
  // Construct coordinate: kind:pubkey:d
  const d = $derived(e.tags.find(t => t[0] === 'd')?.[1] || '');
  const coordinate = $derived(`${e.kind}:${e.pubkey}:${d}`);
  
  const coordD = d || '';
  const coords = { kind: e.kind, pubkey: e.pubkey, d: coordD };

  let stats: SocialCounts = { likes: 0, comments: 0, boosts: 0, zaps: 0 };
  let statsLoading = $state(true);

  onMount(async () => {
      try {
          const res = await getSocialCounts(coords);
          if (res.ok) {
              stats = res.value;
          }
      } finally {
          statsLoading = false;
      }
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="group flex flex-col h-full overflow-hidden rounded-xl bg-white border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-violet-100 cursor-pointer"
  onclick={() => goto(`/read/${coordinate}`)} 
>
  <div class="p-5 flex gap-5">
      <!-- Cover Placeholder -->
      <div class="w-20 aspect-[2/3] rounded bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-300 shadow-inner shrink-0 group-hover:from-violet-50 group-hover:to-indigo-50 group-hover:text-violet-300 transition-colors">
          <Icon name="BookOpen" size={28} />
      </div>
      
      <div class="flex-1 min-w-0">
          <ReasonLine reason={item.reason} score={item.score} />
          
          <h3 class="font-bold text-slate-900 line-clamp-2 leading-tight group-hover:text-violet-700 transition-colors">{title}</h3>
          
          {#if summary}
              <p class="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">{summary}</p>
          {/if}
          
          <div class="mt-3 flex items-center gap-2 text-xs font-medium text-slate-400">
              <div class="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">
                  {e.pubkey.slice(0, 2)}
              </div>
              <span>{e.pubkey.slice(0, 6)}...</span>
              <span class="text-slate-300">•</span>
              <span>{formatDistanceToNow(addedAt)} ago</span>
          </div>
      </div>
</div>
  <div class="px-5 pb-5 pt-0">
      <div class="flex flex-wrap gap-6 text-[11px] text-slate-500">
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
