<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, children }: { title?: string, children: Snippet } = $props();
</script>

<div class="group relative overflow-hidden rounded-xl bg-white border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-200">
  {#if title}
    <div class="border-b border-slate-50 px-6 py-4">
      <h3 class="font-semibold text-slate-900">{title}</h3>
    </div>
  {/if}
  <div class="p-6">
    {@render children()}
  </div>
</div>
