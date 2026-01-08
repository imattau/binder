<script lang="ts">
  import Icon from '../Icon.svelte';
  let { reason, score }: { reason?: string, score?: number } = $props();
</script>

<div class="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
  {#if reason}
      <Icon name="Pulse" size={12} class="text-indigo-400" />
      <span>{reason}</span>
  {/if}
  {#if score && score > 0}
      <span class="bg-indigo-50 text-indigo-700 px-1.5 rounded-full">Score: {score}</span>
  {/if}
</div>