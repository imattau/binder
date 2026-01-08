<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './iconTypes';
  import Badge from './Badge.svelte';
  import type { Snippet } from 'svelte';

  let { 
    icon, 
    title, 
    subtitle, 
    status, 
    onclick,
    actions,
    coverUrl
  }: {
    icon?: IconName,
    title: string,
    subtitle?: string,
    status?: 'draft' | 'ready',
    onclick?: (e: MouseEvent) => void,
    actions?: Snippet,
    coverUrl?: string
  } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="group flex items-center justify-between p-4 mb-2 rounded-lg border border-transparent bg-white shadow-sm transition-all duration-200 hover:border-violet-100 hover:shadow-md hover:shadow-violet-100/50 cursor-pointer"
  onclick={onclick}
>
  <div class="flex items-center gap-4 overflow-hidden">
    {#if coverUrl}
      <div class="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-50 shadow-inner">
        <img src={coverUrl} alt={`Cover for ${title}`} class="h-full w-full object-cover" />
      </div>
    {:else if icon}
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-colors group-hover:bg-violet-50 group-hover:text-violet-600">
        <Icon name={icon} size={20} />
      </div>
    {/if}
    
    <div class="min-w-0 flex-1">
      <h4 class="text-sm font-medium text-slate-900 group-hover:text-violet-700 transition-colors truncate">{title}</h4>
      {#if subtitle}
        <p class="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
      {/if}
    </div>
  </div>

  <div class="flex items-center gap-3">
    {#if status}
       <Badge 
         status={status === 'ready' ? 'success' : 'neutral'} 
         label={status === 'ready' ? 'Ready' : 'Draft'} 
       />
    {/if}
    
    {#if actions}
      <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onclick={(e) => e.stopPropagation()}>
        {@render actions()}
      </div>
    {/if}
  </div>
</div>
