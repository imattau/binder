<script lang="ts">
  import TopNav from './TopNav.svelte';
</script>

<div class="min-h-screen bg-gray-50 flex flex-col">
  <TopNav />
  <main class="flex-grow container mx-auto px-4 py-8 max-w-4xl">
    <slot />
  </main>
  <footer class="text-center py-4 text-gray-400 text-sm">
    Binder - Nostr Book Reader & Writer
  </footer>
</div>
