<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    goto('/discover', { replaceState: true });
  });
</script>

<div class="flex h-[60vh] items-center justify-center">
    <div class="animate-pulse text-slate-400 font-medium">Entering Binder...</div>
</div>
