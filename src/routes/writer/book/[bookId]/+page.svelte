<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentBookStore } from '$lib/state/currentBookStore';
  import { chapterDraftService } from '$lib/services/chapterDraftService';
  import { bookService } from '$lib/services/bookService';
  import { publisherService, type PublishResult } from '$lib/services/publisherService';
  import { compressImage, blobToDataUrl } from '$lib/services/mediaService';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import ListRow from '$lib/ui/components/ListRow.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Input from '$lib/ui/components/Input.svelte';
  import Card from '$lib/ui/components/Card.svelte';
  import EmptyState from '$lib/ui/components/EmptyState.svelte';
  import PublishModal from '$lib/ui/components/PublishModal.svelte';
  import AddExistingChapterModal from '$lib/ui/components/AddExistingChapterModal.svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import type { LocalChapterDraft } from '$lib/domain/types';
  import type { NostrEvent } from 'nostr-tools';
  import { authStore } from '$lib/state/authStore';
  import { writerBooksStore } from '$lib/state/writerBooksStore';

  const bookId = $page.params.bookId || '';
  let isEditingTitle = false;
  let editTitle = '';
  let isUploadingCover = false;
  let showExistingModal = false;

  // Publishing State
  let showPublishModal = false;
  let isPublishing = false;
  let publishResults: PublishResult[] | null = null;
  let publishError: { message: string } | null = null;

  onMount(() => {
    if (!$authStore.pubkey) {
        goto('/login');
        return;
    }
    if (bookId) {
        currentBookStore.load(bookId);
    }
  });

  async function handleCreateChapter() {
    const title = prompt('Chapter Title:');
    if (title && bookId) {
        const res = await chapterDraftService.createChapter(bookId, title);
        if (res.ok) {
            currentBookStore.refreshChapters(bookId);
        }
    }
  }

  function handleDndConsider(e: CustomEvent<DndEvent<LocalChapterDraft>>) {
      $currentBookStore.chapters = e.detail.items;
  }

  async function handleDndFinalize(e: CustomEvent<DndEvent<LocalChapterDraft>>) {
      $currentBookStore.chapters = e.detail.items;
      const newOrder = e.detail.items.map(c => c.id);
      if (bookId) {
          await chapterDraftService.reorderChapters(bookId, newOrder);
      }
  }
  
  async function saveBookTitle() {
      if (!$currentBookStore.book || !editTitle.trim()) return;
      const updated = { ...$currentBookStore.book, title: editTitle };
      await bookService.updateBook(updated);
      $currentBookStore.book = updated;
      isEditingTitle = false;
  }

  function startTitleEdit() {
      if ($currentBookStore.book) {
          editTitle = $currentBookStore.book.title;
          isEditingTitle = true;
      }
  }

  async function handleExistingChapterAdd(event: NostrEvent) {
      if (!bookId) throw new Error('Book not loaded');
      const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Imported Chapter';
      const content = event.content || '';
      const res = await chapterDraftService.importChapter(bookId, title, content, 'ready');
      if (!res.ok) {
          throw new Error(res.error.message);
      }
      await currentBookStore.load(bookId);
  }

  async function handlePublishConfirm() {
      if (!$currentBookStore.book) return;
      
      isPublishing = true;
      publishResults = null;
      publishError = null;
      
      const res = await publisherService.publishBook($currentBookStore.book, $currentBookStore.chapters);
      
      isPublishing = false;
      if (res.ok) {
          publishResults = res.value;
      } else {
          publishError = res.error;
      }
  }

  function closePublishModal() {
      showPublishModal = false;
      publishResults = null;
      publishError = null;
  }

  async function handleCoverUpload(e: Event) {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files[0] && $currentBookStore.book) {
          isUploadingCover = true;
          try {
              const file = input.files[0];
              const payload = await compressImage(file);
              const preview = await blobToDataUrl(payload);
              const updated = { ...$currentBookStore.book, cover: preview };
              await bookService.updateBook(updated);
              await currentBookStore.load(bookId);
              await writerBooksStore.load();
          } catch (e) {
              console.error('Cover processing failed', e);
          } finally {
              isUploadingCover = false;
          }
      }
  }
</script>

{#if $currentBookStore.loading}
  <div class="text-center py-12 text-slate-500">Loading book...</div>
{:else if $currentBookStore.book}
  <div class="mb-6">
      <Button variant="secondary" onclick={() => goto('/writer')}>
        <div class="flex items-center gap-2">
            <Icon name="ArrowLeft" /> Back
        </div>
      </Button>
  </div>

  <div class="flex items-start gap-6 mb-8">
    <!-- Cover Image -->
    <div class="w-32 h-48 bg-slate-100 rounded-lg shadow-sm flex items-center justify-center relative overflow-hidden group shrink-0">
        {#if $currentBookStore.book.cover}
            <img src={$currentBookStore.book.cover} alt="Book Cover" class="w-full h-full object-cover" />
        {:else}
            <Icon name="BookOpen" size={48} class="text-slate-300" />
        {/if}
        
        <label class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <input type="file" accept="image/*" class="hidden" onchange={handleCoverUpload} />
            <div class="text-white flex flex-col items-center">
                {#if isUploadingCover}
                    <Icon name="Pulse" class="animate-spin" />
                {:else}
                    <Icon name="CloudArrowDown" />
                    <span class="text-xs mt-1">Change</span>
                {/if}
            </div>
        </label>
    </div>

    <div class="flex-grow">
        <div class="flex items-center justify-between mb-2">
            <div>
                {#if isEditingTitle}
                    <div class="flex gap-2">
                        <Input bind:value={editTitle} />
                        <Button onclick={saveBookTitle}>Save</Button>
                        <Button variant="secondary" onclick={() => isEditingTitle = false}>Cancel</Button>
                    </div>
                {:else}
                     <!-- svelte-ignore a11y_click_events_have_key_events -->
                     <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <h1 class="text-3xl font-bold text-slate-900 flex items-center gap-2 group cursor-pointer" onclick={startTitleEdit}>
                        {$currentBookStore.book.title}
                        <Icon name="PencilSimple" class="text-slate-400 opacity-0 group-hover:opacity-100" />
                    </h1>
                {/if}
                <p class="text-slate-500 mt-1">{$currentBookStore.chapters.length} chapters</p>
            </div>
            <div class="flex gap-2">
                <Button 
                    onclick={() => showPublishModal = true} 
                    disabled={$currentBookStore.chapters.length === 0}
                >
                    <div class="flex items-center gap-2">
                        <Icon name="CloudCheck" /> Publish Book
                    </div>
                </Button>
                <Button variant="secondary" onclick={() => showExistingModal = true}>
                    <div class="flex items-center gap-2">
                        <Icon name="BookOpen" /> Add Existing
                    </div>
                </Button>
                <Button variant="secondary" onclick={handleCreateChapter}>
                    <div class="flex items-center gap-2">
                        <Icon name="Plus" /> New Chapter
                    </div>
                </Button>
            </div>
        </div>
    </div>
  </div>

  <Card>
      <div class="flex items-center justify-between mb-4">
          <div class="text-lg font-semibold text-slate-900">Chapters</div>
      </div>

      {#if $currentBookStore.chapters.length === 0}
         <EmptyState 
            icon="FileText" 
            title="No chapters yet" 
            description="Create your first chapter to start writing."
         />
      {:else}
         <section 
            use:dndzone={{items: $currentBookStore.chapters, flipDurationMs: 300, dropTargetStyle: { border: 'none', outline: 'none' }}} 
            onconsider={handleDndConsider} 
            onfinalize={handleDndFinalize}
            class="space-y-2 outline-none"
         >
            {#each $currentBookStore.chapters as chapter (chapter.id)}
                <div animate:flip={{duration: 300}}>
                    <ListRow 
                        icon="FileText" 
                        title={chapter.title} 
                        subtitle="Word count: {chapter.contentMd.split(/\s+/).length}"
                        status={chapter.status}
                        onclick={() => goto(`/writer/book/${bookId}/chapter/${chapter.id}`)}
                    >
                        {#snippet actions()}
                            <div class="text-slate-400 cursor-grab active:cursor-grabbing p-2 hover:bg-slate-50 rounded">
                                <Icon name="DotsSixVertical" />
                            </div>
                        {/snippet}
                    </ListRow>
                </div>
            {/each}
         </section>
      {/if}
  </Card>

  <AddExistingChapterModal 
      isOpen={showExistingModal}
      existingDs={$currentBookStore.chapters.map(c => c.d)}
      onClose={() => showExistingModal = false}
      onAdd={handleExistingChapterAdd}
  />

  <PublishModal 
      isOpen={showPublishModal}
      isPublishing={isPublishing}
      results={publishResults}
      error={publishError}
      onConfirm={handlePublishConfirm}
      onClose={closePublishModal}
  />

{:else}
  <div class="text-center py-12 text-slate-500">Book not found</div>
{/if}
