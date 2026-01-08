<script lang="ts">
  import TopNav from './TopNav.svelte';
  let { children } = $props();
</script>

<div class="min-h-screen flex flex-col" style="background: var(--surface-1); color: var(--text-0);">
  <TopNav />
  <main class="flex-grow container mx-auto px-4 py-8 max-w-4xl" style="background: transparent; color: inherit;">
    {@render children()}
  </main>
  <footer class="text-center py-4 text-sm" style="color: var(--text-2);">
    Binder - Nostr Book Reader & Writer
  </footer>
</div>
