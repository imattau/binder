<svelte:options runes={false} />
<script lang="ts">
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import { longFormService } from '$lib/services/longFormService';
  import type { NostrEvent } from 'nostr-tools';

  export let isOpen = false;
  export let existingDs: string[] = [];
  export let onClose!: () => void;
  export let onAdd!: (event: NostrEvent) => Promise<void>;

  let events: NostrEvent[] = [];
  let loading = false;
  let error = '';
  let fetched = false;
  let addingId: string | null = null;
  let existingSet: Set<string> = new Set();
  let availablePosts: { event: NostrEvent; d: string; title: string; snippet: string; createdAt: number }[] = [];

  $: if (isOpen && !fetched) {
    fetched = true;
    loadEvents();
  }

  $: if (!isOpen && fetched) {
    fetched = false;
    events = [];
    error = '';
  }

  async function loadEvents() {
    loading = true;
    error = '';
    const res = await longFormService.fetchMyLongForms();
    loading = false;
    if (res.ok) {
      events = res.value;
    } else {
      error = res.error.message;
    }
  }

  $: existingSet = new Set(existingDs ?? []);

  $: availablePosts = events
    .map((event) => {
      const dTag = event.tags.find((t) => t[0] === 'd')?.[1];
      if (!dTag) return null;
      const title = event.tags.find((t) => t[0] === 'title')?.[1] || 'Untitled';
      const summary = event.tags.find((t) => t[0] === 'summary')?.[1];
      const snippet = summary || event.content?.slice(0, 180) || '';
      return { event, d: dTag, title, snippet, createdAt: event.created_at };
    })
    .filter((item): item is { event: NostrEvent; d: string; title: string; snippet: string; createdAt: number } => !!item)
    .filter((item) => {
      if (existingSet.has(item.d)) return false;
      return !item.event.tags.some((t) => t[0] === 'book');
    });

  async function handleAdd(event: NostrEvent) {
    addingId = event.id;
    error = '';
    try {
      await onAdd(event);
      onClose();
    } catch (e: any) {
      error = e?.message || 'Failed to add chapter';
    } finally {
      addingId = null;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-100">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div class="flex items-center gap-2 text-slate-900 font-semibold">
          <Icon name="FileText" size={20} />
          Import Existing Chapter
        </div>
        <button onclick={onClose} class="text-slate-500 hover:text-slate-700">
          <Icon name="X" size={20} />
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        {#if loading}
          <div class="flex items-center gap-2 text-slate-500">
            <Icon name="Pulse" class="animate-spin" />
            Loading your long-form posts...
          </div>
        {:else if error}
          <div class="text-sm text-rose-600">{error}</div>
        {:else if availablePosts.length === 0}
          <div class="text-sm text-slate-500">
            No standalone long-form posts found. Publish new entries or remove ones already in this book.
          </div>
        {/if}

        {#if !loading && availablePosts.length > 0}
          <div class="space-y-3 max-h-80 overflow-y-auto pr-2">
            {#each availablePosts as post (post.event.id)}
              <div class="border border-slate-100 rounded-xl p-4 bg-slate-50 flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-center justify-between gap-4">
                    <p class="font-semibold text-slate-900">{post.title}</p>
                    <span class="text-xs uppercase tracking-wide text-slate-400">
                      {new Date(post.createdAt * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-slate-500 leading-relaxed max-h-14 overflow-hidden">{post.snippet}</p>
                </div>
                <div>
                  <Button 
                    variant="primary" 
                    onclick={() => handleAdd(post.event)}
                    disabled={addingId === post.event.id}
                  >
                    {#if addingId === post.event.id}
                      <Icon name="Pulse" class="animate-spin mr-1" size={14} />
                      Adding...
                    {:else}
                      Add
                    {/if}
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
