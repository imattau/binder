<script lang="ts">
  import { onMount } from 'svelte';
  import { writerBooksStore } from '$lib/state/writerBooksStore';
  import { authStore } from '$lib/state/authStore';
  import { bookService } from '$lib/services/bookService';
  import { goto } from '$app/navigation';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import LayoutToggle from '$lib/ui/components/LayoutToggle.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import ListRow from '$lib/ui/components/ListRow.svelte';
  import EmptyState from '$lib/ui/components/EmptyState.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Input from '$lib/ui/components/Input.svelte';
  import { bookLayoutStore } from '$lib/state/bookLayoutStore';

  let isCreating = false;
  let newTitle = '';

  onMount(() => {
    if (!$authStore.pubkey) {
        goto('/login');
        return;
    }
    writerBooksStore.load();
  });

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const res = await bookService.createBook(newTitle.trim());
    if (res.ok) {
        writerBooksStore.add(res.value);
        newTitle = '';
        isCreating = false;
        goto(`/writer/book/${res.value.id}`);
    }
  }

  async function handleDelete(id: string, e: Event) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this book?')) {
        const res = await bookService.deleteBook(id);
        if (res.ok) {
            writerBooksStore.remove(id);
        }
    }
  }
</script>

    <div class="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
  <SectionHeader title="Your Books" subtitle="Manage your local drafts" />
  <div class="flex items-center gap-3">
    <LayoutToggle />
    {#if $writerBooksStore.length > 0 && !isCreating}
        <Button onclick={() => isCreating = true}>
            <div class="flex items-center gap-2">
                <Icon name="Plus" />
                New Book
            </div>
        </Button>
    {/if}
  </div>
</div>

{#if isCreating}
    <div class="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-6">
        <h3 class="text-sm font-medium text-slate-900 mb-3">Create New Book</h3>
        <div class="flex gap-2">
            <Input bind:value={newTitle} placeholder="Enter book title..." />
            <Button onclick={handleCreate}>Create</Button>
            <Button variant="secondary" onclick={() => isCreating = false}>Cancel</Button>
        </div>
    </div>
{/if}

{#if $writerBooksStore.length === 0 && !isCreating}
  <EmptyState 
    icon="BookOpen" 
    title="No books yet" 
    description="Start writing your first book today. Drafts are stored locally." 
    actionLabel="Create Book"
    onaction={() => isCreating = true}
  />
{:else}
  {#if $bookLayoutStore === 'grid'}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each $writerBooksStore as book}
          <button
            type="button"
            class="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-200 hover:border-violet-100 hover:shadow-lg cursor-pointer"
            onclick={() => goto(`/writer/book/${book.id}`)}
          >
          <div class="relative h-48 bg-slate-100">
            {#if book.cover}
              <img src={book.cover} alt={`Cover for ${book.title}`} class="h-full w-full object-cover" />
            {:else}
              <div class="flex h-full w-full items-center justify-center text-slate-300">
                <Icon name="BookOpen" size={40} />
              </div>
            {/if}
          </div>
          <div class="flex flex-col gap-2 p-4">
            <h3 class="text-lg font-semibold text-slate-900 line-clamp-2">{book.title}</h3>
            {#if book.summary}
              <p class="text-sm text-slate-500 line-clamp-3">{book.summary}</p>
            {/if}
            <div class="mt-3 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <span>{book.chapterOrder.length} chapters</span>
              <span>{new Date(book.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="space-y-2">
      {#each $writerBooksStore as book}
        <ListRow 
          coverUrl={book.cover}
          icon="BookOpen" 
          title={book.title} 
          subtitle={`${book.chapterOrder.length} chapters • Updated ${new Date(book.updatedAt).toLocaleDateString()}`}
          onclick={() => goto(`/writer/book/${book.id}`)}
        >
          {#snippet actions()}
                  <button 
                      class="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                      onclick={(e) => handleDelete(book.id, e)}
                      title="Delete book"
                  >
                      <Icon name="Trash" />
                  </button>
          {/snippet}
        </ListRow>
      {/each}
    </div>
  {/if}
{/if}
