<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentBookStore } from '$lib/state/currentBookStore';
  import { get } from 'svelte/store';
  import { chapterDraftService } from '$lib/services/chapterDraftService';
  import { bookService } from '$lib/services/bookService';
  import { publisherService, type PublishResult } from '$lib/services/publisherService';
  import { profileService } from '$lib/services/profileService';
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
  import type { LocalChapterDraft, LocalBook, AuthorProfile } from '$lib/domain/types';
  import { nip19 } from 'nostr-tools';
  import type { NostrEvent } from 'nostr-tools';
  import { authStore } from '$lib/state/authStore';
  import { writerBooksStore } from '$lib/state/writerBooksStore';
  import { bookFingerprint } from '$lib/utils/publicationFingerprint';

  const bookId = $page.params.bookId || '';
  let isEditingTitle = $state(false);
  let editTitle = $state('');
  let isUploadingCover = $state(false);
  let showExistingModal = $state(false);

  // Publishing State
  let showPublishModal = $state(false);
  let isPublishing = $state(false);
  let publishResults = $state<PublishResult[] | null>(null);
  let publishError = $state<{ message: string } | null>(null);
  let currentHash = $state('');
  let lastPublishedHash = $state<string | null>(null);
  let publishLabel = $state('Publish Book');
  let publishDisabled = $state(true);

  let metadataBookId = $state('');
  let blurbDraft = $state('');
  let topicsDraft = $state<string[]>([]);
  let topicInput = $state('');
  let topicError = $state<string | null>(null);
  let coAuthorsDraft = $state<string[]>([]);
  let newCoAuthor = $state('');
  let coAuthorError = $state<string | null>(null);
  let coAuthorProfiles = $state<Record<string, Partial<AuthorProfile>>>({});
  const profileCache = new Map<string, Partial<AuthorProfile>>();

  function handlePublishButtonClick() {
      if (publishDisabled) return;
      showPublishModal = true;
  }

  type CurrentBookState = {
      book: LocalBook | null;
      chapters: LocalChapterDraft[];
      loading: boolean;
  };

  async function updatePublishState(stateParam?: CurrentBookState) {
      const state = stateParam ?? get(currentBookStore);
      if (!state.book) {
          currentHash = '';
          lastPublishedHash = null;
          publishLabel = 'Publish Book';
          publishDisabled = true;
          return;
      }

      const computedHash = await bookFingerprint(state.book);
      currentHash = computedHash;
      lastPublishedHash = state.book.publishedHash ?? null;
      const hasPublished = Boolean(lastPublishedHash);
      const dirty = !hasPublished || computedHash !== lastPublishedHash;
      publishLabel = hasPublished ? (dirty ? 'Update Book' : 'Up to date') : 'Publish Book';
      publishDisabled = state.chapters.length === 0 || isPublishing || (hasPublished && !dirty);
  }

  const unsubscribe = currentBookStore.subscribe((state) => {
      void updatePublishState(state);
  });

  $effect(() => {
      if ($currentBookStore.book && metadataBookId !== $currentBookStore.book.id) {
          metadataBookId = $currentBookStore.book.id;
          blurbDraft = $currentBookStore.book.summary ?? '';
          topicsDraft = [...($currentBookStore.book.topics ?? [])];
          coAuthorsDraft = [...($currentBookStore.book.coAuthors ?? [])];
          void refreshCoAuthorProfiles(coAuthorsDraft);
      }
  });

  async function refreshCoAuthorProfiles(pubkeys: string[]) {
      const profiles: Record<string, Partial<AuthorProfile>> = {};
      for (const pubkey of pubkeys) {
          if (profileCache.has(pubkey)) {
              profiles[pubkey] = profileCache.get(pubkey)!;
              continue;
          }
          const res = await profileService.loadProfile(pubkey);
          const profile = res.ok ? res.value ?? {} : {};
          profileCache.set(pubkey, profile);
          profiles[pubkey] = profile;
      }
      coAuthorProfiles = profiles;
  }

  function normalizeTopic(value: string): string {
      return value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-+]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
  }

  async function saveMetadata(): Promise<boolean> {
      if (!$currentBookStore.book) return false;
      topicError = null;
      coAuthorError = null;
      const sanitizedTopics = topicsDraft
          .map(normalizeTopic)
          .filter(Boolean);
      const updatedBook: LocalBook = {
          ...$currentBookStore.book,
          summary: blurbDraft.trim() || undefined,
          topics: Array.from(new Set(sanitizedTopics)),
          coAuthors: Array.from(new Set(coAuthorsDraft.map(pk => pk.toLowerCase())))
      };

      const res = await bookService.updateBook(updatedBook);
      if (res.ok) {
          $currentBookStore.book = updatedBook;
          void writerBooksStore.load();
      } else {
          topicError = res.error?.message ?? 'Failed to save book metadata';
      }
      return res.ok;
  }

  async function addTopic() {
      topicError = null;
      const normalized = normalizeTopic(topicInput);
      if (!normalized) {
          topicError = 'Enter a valid topic';
          return;
      }
      if (topicsDraft.includes(normalized)) {
          topicError = 'Topic already added';
          return;
      }
      topicsDraft = [...topicsDraft, normalized];
      topicInput = '';
      await saveMetadata();
  }

  async function removeTopic(topic: string) {
      topicsDraft = topicsDraft.filter(t => t !== topic);
      await saveMetadata();
  }

  function decodeCoAuthorInput(value: string): string | null {
      if (!value) return null;
      if (/^npub/i.test(value)) {
          try {
              const decoded = nip19.decode(value);
              if (decoded.type === 'npub' && typeof decoded.data === 'string') {
                  return decoded.data;
              }
          } catch (error) {
              return null;
          }
      }
      if (/^[0-9a-fA-F]{64}$/.test(value)) {
          return value.toLowerCase();
      }
      return null;
  }

  async function addCoAuthor() {
      coAuthorError = null;
      const pubkey = decodeCoAuthorInput(newCoAuthor.trim());
      if (!pubkey) {
          coAuthorError = 'Enter a valid npub or hex pubkey';
          return;
      }
      if (coAuthorsDraft.includes(pubkey)) {
          coAuthorError = 'Co-author already added';
          return;
      }
      coAuthorsDraft = [...coAuthorsDraft, pubkey];
      newCoAuthor = '';
      await refreshCoAuthorProfiles(coAuthorsDraft);
      await saveMetadata();
  }

  async function removeCoAuthor(pubkey: string) {
      coAuthorsDraft = coAuthorsDraft.filter(key => key !== pubkey);
      await refreshCoAuthorProfiles(coAuthorsDraft);
      await saveMetadata();
  }

  function formatCoAuthorLabel(pubkey: string) {
      const profile = coAuthorProfiles[pubkey];
      return profile?.displayName || profile?.name || `${pubkey.slice(0, 6)}...`;
  }

  onMount(() => {
    if (!$authStore.pubkey) {
        goto('/login');
        return;
    }
    if (bookId) {
        currentBookStore.load(bookId);
    }
  });

  onDestroy(() => unsubscribe());

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
      await updatePublishState();
      publishResults = null;
      publishError = null;
      
      const res = await publisherService.publishBook($currentBookStore.book, $currentBookStore.chapters);
      
      isPublishing = false;
      await updatePublishState();
      if (res.ok) {
          publishResults = res.value;
          if ($currentBookStore.book) {
              const fingerprint = await bookFingerprint($currentBookStore.book);
              const updatedBook = { ...$currentBookStore.book, publishedHash: fingerprint };
              $currentBookStore.book = updatedBook;
          }
          await updatePublishState();
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
                    onclick={handlePublishButtonClick} 
                    disabled={publishDisabled}
                >
                    <div class="flex items-center gap-2">
                        <Icon name="CloudCheck" /> {publishLabel}
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

  <div class="mb-8">
    <Card>
      <div class="flex items-center justify-between mb-4">
          <div>
              <p class="text-lg font-semibold text-slate-900">Blurb & topics</p>
              <p class="text-sm text-slate-500">Share a short summary and tag what makes this book unique.</p>
          </div>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
          <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-600" for="book-blurb">Book blurb</label>
              <textarea
                  id="book-blurb"
                  rows="4"
                  bind:value={blurbDraft}
                  class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  placeholder="Describe the tone, themes, or what readers can expect."
              ></textarea>
          </div>
          <div class="md:col-span-2 lg:col-span-1">
              <div class="flex items-center justify-between">
                  <p class="text-sm font-medium text-slate-600">Topics</p>
                  <span class="text-xs text-slate-400">Displayed as hashtags</span>
              </div>
              <div class="mt-2 flex gap-2">
                  <div class="flex-1">
                      <Input
                          placeholder="e.g. worldbuilding"
                          bind:value={topicInput}
                      />
                  </div>
                  <Button variant="secondary" onclick={() => void addTopic()}>
                      <div class="flex items-center gap-2">
                          <Icon name="Plus" size={14} />
                          Add
                      </div>
                  </Button>
              </div>
              {#if topicError}
                  <p class="mt-1 text-xs text-rose-500">{topicError}</p>
              {/if}
              <div class="mt-3 flex flex-wrap gap-2">
                  {#each topicsDraft as topic (topic)}
                      <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          #{topic}
                          <button 
                              type="button"
                              class="text-slate-400 hover:text-slate-600"
                              onclick={() => void removeTopic(topic)}
                          >
                              <Icon name="X" size={12} />
                          </button>
                      </span>
                  {/each}
              </div>
          </div>
      </div>
      <div class="mt-4">
          <Button onclick={() => void saveMetadata()}>
              <div class="flex items-center gap-2">
                  <Icon name="FloppyDisk" size={16} />
                  Save blurb & topics
              </div>
          </Button>
      </div>

      <div class="mt-6 border-t border-slate-100 pt-4">
          <div class="flex items-center justify-between">
              <div>
                  <p class="text-lg font-semibold text-slate-900">Co-authors</p>
                  <p class="text-sm text-slate-500">Add collaborators via their npub or hex pubkey.</p>
              </div>
          </div>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row">
              <div class="flex-1">
                  <Input
                      placeholder="npub..."
                      bind:value={newCoAuthor}
                  />
              </div>
             <Button variant="secondary" onclick={() => void addCoAuthor()}>
                  <div class="flex items-center gap-2">
                      <Icon name="Plus" size={14} />
                      Add
                  </div>
              </Button>
          </div>
          {#if coAuthorError}
              <p class="mt-1 text-xs text-rose-500">{coAuthorError}</p>
          {/if}
          <div class="mt-4 flex flex-wrap gap-3">
              {#each coAuthorsDraft as pubkey (pubkey)}
                  <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                      <span>{formatCoAuthorLabel(pubkey)}</span>
                      <button
                          type="button"
                          class="text-slate-400 hover:text-slate-600"
                          onclick={() => void removeCoAuthor(pubkey)}
                      >
                          <Icon name="X" size={12} />
                      </button>
                  </div>
              {/each}
          </div>
      </div>
    </Card>
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
