<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { beforeNavigate } from '$app/navigation';
  import { currentChapterStore } from '$lib/state/currentChapterStore';
  import { editorUiStore } from '$lib/state/editorUiStore';
  import { authStore } from '$lib/state/authStore';
  import { markdownService } from '$lib/services/markdownService';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import SplitPane from '$lib/ui/components/SplitPane.svelte';
  import CodeMirror from '$lib/ui/components/CodeMirror.svelte';
  import Badge from '$lib/ui/components/Badge.svelte';
  import Input from '$lib/ui/components/Input.svelte';
  import { mediaService } from '$lib/services/mediaService';
  import type { DraftSnapshot } from '$lib/domain/types';
  import { formatDistanceToNow } from 'date-fns';

  const bookId = $page.params.bookId || '';
  const chapterId = $page.params.chapterId || '';
  
  let isEditingTitle = $state(false);
  let showHistory = $state(false);
  let editTitle = $state('');
  let autoSaveTimer: ReturnType<typeof setTimeout>;
  let codeMirrorRef = $state<{
    wrapSelection?: (prefix: string, suffix?: string, placeholder?: string) => void;
    insertAtLineStart?: (prefix: string) => void;
  } | null>(null);
  let imageInput = $state<HTMLInputElement | null>(null);
  let isUploadingImage = $state(false);
  let imageUploadError = $state('');

  onMount(() => {
    if (!$authStore.pubkey) {
        goto('/login');
        return;
    }
    if (chapterId) {
        currentChapterStore.load(chapterId);
    }
    beforeNavigate(() => {
        void currentChapterStore.save();
    });
    window.addEventListener('beforeunload', handleBeforeUnload);
  });
  
  function handleBeforeUnload(event: BeforeUnloadEvent) {
      void currentChapterStore.save();
  }

  onDestroy(() => {
      clearTimeout(autoSaveTimer);
      // Final save on exit if dirty
      if ($currentChapterStore.isDirty) {
          currentChapterStore.save();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  function handleContentChange(newContent: string) {
      currentChapterStore.updateContent(newContent);
      
      // Debounced autosave
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(async () => {
          $editorUiStore.isSaving = true;
          await currentChapterStore.save();
          $editorUiStore.lastAutoSave = Date.now();
          $editorUiStore.isSaving = false;
      }, 1000);
  }

  async function handleSnapshot() {
      const reason = prompt('Snapshot reason (optional):') || 'Manual snapshot';
      await currentChapterStore.createSnapshot(reason);
  }

  function restoreSnapshot(snapshot: DraftSnapshot) {
      if (confirm(`Restore snapshot "${snapshot.reason}"? This will overwrite your current draft.`)) {
          handleContentChange(snapshot.contentMd);
          showHistory = false;
      }
  }

  function toggleStatus() {
      if (!$currentChapterStore.chapter) return;
      const newStatus = $currentChapterStore.chapter.status === 'draft' ? 'ready' : 'draft';
      $currentChapterStore.chapter.status = newStatus; // Local optimistic update
      currentChapterStore.save();
  }

  async function saveTitle() {
      if (!$currentChapterStore.chapter || !editTitle.trim()) return;
      $currentChapterStore.chapter.title = editTitle;
      await currentChapterStore.save();
      isEditingTitle = false;
  }
  
  function startTitleEdit() {
      if ($currentChapterStore.chapter) {
          editTitle = $currentChapterStore.chapter.title;
          isEditingTitle = true;
      }
  }

  function setEditorPane(mode: 'edit' | 'split' | 'preview') {
      $editorUiStore.pane = mode;
  }

  function addHeading(level: number) {
      const prefix = '#'.repeat(level) + ' ';
      codeMirrorRef?.insertAtLineStart?.(prefix);
  }

  function applyInline(prefix: string, suffix: string, placeholder: string) {
      codeMirrorRef?.wrapSelection?.(prefix, suffix, placeholder);
  }

  async function handleImageUpload(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input?.files?.[0];
      if (!file) return;
      isUploadingImage = true;
      imageUploadError = '';
      try {
          const res = await mediaService.uploadImage(file);
          if (res.ok) {
              codeMirrorRef?.wrapSelection?.('![', `](${res.value})`, 'alt text');
          } else {
              imageUploadError = res.error.message;
          }
      } catch (e: any) {
          imageUploadError = e?.message || 'Image upload failed';
      } finally {
          isUploadingImage = false;
          if (input) {
              input.value = '';
          }
      }
  }

  const toolbarControls = [
      { label: 'H1', action: () => addHeading(1) },
      { label: 'H2', action: () => addHeading(2) },
      { label: 'Bold', action: () => applyInline('**', '**', 'bold text') },
      { label: 'Italic', action: () => applyInline('*', '*', 'italic text') },
      { label: 'Quote', action: () => codeMirrorRef?.insertAtLineStart?.('> ') },
      { label: 'Bullet', action: () => codeMirrorRef?.insertAtLineStart?.('- ') },
      { label: 'Numbered', action: () => codeMirrorRef?.insertAtLineStart?.('1. ') },
      { label: 'Link', action: () => applyInline('[', '](https://)', 'link text') }
  ];

  const layoutModes: { id: 'edit' | 'split' | 'preview'; label: string }[] = [
      { id: 'edit', label: 'Write' },
      { id: 'split', label: 'Split' },
      { id: 'preview', label: 'Preview' }
  ];
</script>

{#if $currentChapterStore.loading}
    <div class="text-center py-12 text-gray-500">Loading chapter...</div>
{:else if $currentChapterStore.chapter}
    <div class="h-screen flex flex-col bg-white">
        <!-- Sticky Header -->
        <header class="h-16 border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 bg-white z-10">
            <div class="flex items-center gap-4 w-1/3">
                <button onclick={() => goto(`/writer/book/${bookId}`)} class="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                    <Icon name="ArrowLeft" /> Back
                </button>
            </div>
            
            <div class="flex-1 flex flex-col items-center justify-center">
                 {#if isEditingTitle}
                    <div class="flex gap-2">
                        <Input bind:value={editTitle} />
                        <Button onclick={saveTitle}>Save</Button>
                    </div>
                {:else}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="flex items-center gap-2 cursor-pointer group" onclick={startTitleEdit}>
                         <h2 class="font-semibold text-gray-900 truncate max-w-xs">{$currentChapterStore.chapter.title}</h2>
                         <Icon name="PencilSimple" size={14} class="text-gray-400 opacity-0 group-hover:opacity-100" />
                    </div>
                {/if}
                <div class="flex items-center gap-2 mt-1">
                    <Badge 
                        status={$currentChapterStore.chapter.status === 'ready' ? 'success' : 'neutral'} 
                        label={$currentChapterStore.chapter.status === 'ready' ? 'Ready' : 'Draft'} 
                    />
                    {#if $editorUiStore.isSaving}
                        <span class="text-xs text-gray-400 flex items-center gap-1">
                            <Icon name="Pulse" size={12} /> Saving...
                        </span>
                    {:else if $editorUiStore.lastAutoSave}
                        <span class="text-xs text-gray-400 flex items-center gap-1">
                            <Icon name="CloudCheck" size={12} /> Saved
                        </span>
                    {/if}
                </div>
            </div>
            
            <div class="flex items-center justify-end gap-2 w-1/3">
                 <Button variant={showHistory ? 'primary' : 'secondary'} onclick={() => showHistory = !showHistory}>
                    <Icon name="ClockCounterClockwise" />
                 </Button>
                 <Button 
                    variant={$currentChapterStore.chapter.status === 'ready' ? 'secondary' : 'primary'} 
                    onclick={toggleStatus}
                 >
                    <div class="flex items-center gap-2">
                        <Icon name={$currentChapterStore.chapter.status === 'ready' ? 'PencilSimple' : 'SealCheck'} />
                        {$currentChapterStore.chapter.status === 'ready' ? 'Revert to Draft' : 'Mark Ready'}
                    </div>
                 </Button>
            </div>
        </header>
        
        <div class="border-b border-gray-100 px-4 py-3 flex flex-wrap gap-3 bg-white items-center">
            <div class="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {#each toolbarControls as control}
                    <button
                        type="button"
                        class="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 transition"
                        onclick={control.action}
                    >
                        {control.label}
                    </button>
                {/each}
                <input type="file" accept="image/*" class="hidden" bind:this={imageInput} onchange={handleImageUpload} />
                <button
                    type="button"
                    class="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1"
                    onclick={() => imageInput?.click()}
                    disabled={isUploadingImage}
                >
                    {#if isUploadingImage}
                        <Icon name="Pulse" class="animate-spin" size={12} />
                        Uploading...
                    {:else}
                        Image
                    {/if}
                </button>
            </div>
            <div class="ml-auto flex items-center gap-2">
                {#each layoutModes as mode}
                    <button
                        type="button"
                        class={`px-3 py-1 rounded-full border text-xs font-semibold transition ${$editorUiStore.pane === mode.id ? 'bg-slate-900 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                        onclick={() => setEditorPane(mode.id)}
                    >
                        {mode.label}
                    </button>
                {/each}
            </div>
        </div>

        {#if imageUploadError}
            <div class="px-4 pt-2 text-xs text-rose-600">{imageUploadError}</div>
        {/if}
        
        <!-- Editor Area -->
        <div class="flex-grow flex flex-col overflow-hidden">
            {#if $editorUiStore.pane === 'split'}
                <div class="flex-grow">
                    <SplitPane>
                        {#snippet left()}
                            <div class="h-full">
                                <CodeMirror 
                                    bind:this={codeMirrorRef}
                                    bind:value={$currentChapterStore.chapter!.contentMd} 
                                    onchange={handleContentChange}
                                />
                            </div>
                        {/snippet}
                        {#snippet right()}
                            <div class="prose max-w-none p-8 h-full overflow-y-auto">
                                {@html markdownService.render($currentChapterStore.chapter!.contentMd)}
                            </div>
                        {/snippet}
                    </SplitPane>
                </div>
            {:else if $editorUiStore.pane === 'preview'}
                <div class="flex-grow overflow-y-auto bg-white">
                    <div class="prose max-w-none p-8">{@html markdownService.render($currentChapterStore.chapter!.contentMd)}</div>
                </div>
            {:else}
                <div class="flex-grow h-full">
                    <CodeMirror 
                        bind:this={codeMirrorRef}
                        bind:value={$currentChapterStore.chapter!.contentMd} 
                        onchange={handleContentChange}
                    />
                </div>
            {/if}
        </div>
    </div>
{:else}
    <div class="text-center py-12 text-gray-500">Chapter not found</div>
{/if}

{#if showHistory}
  <div class="fixed inset-0 z-50 flex justify-end">
     <!-- Backdrop -->
     <!-- svelte-ignore a11y_click_events_have_key_events -->
     <!-- svelte-ignore a11y_no_static_element_interactions -->
     <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" onclick={() => showHistory = false}></div>
     
     <!-- Drawer -->
     <div class="relative w-80 bg-white shadow-2xl h-full border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200">
        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-gray-900 flex items-center gap-2">
                <Icon name="ClockCounterClockwise" /> History
            </h3>
            <button onclick={() => showHistory = false} class="text-gray-400 hover:text-gray-600">
                <Icon name="X" />
            </button>
        </div>
        
        <div class="p-4 border-b border-gray-100">
            <Button class="w-full justify-center" variant="secondary" onclick={handleSnapshot}>
                <Icon name="Plus" /> Create Snapshot
            </Button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {#each $currentChapterStore.snapshots as snap}
               <div class="group border border-gray-100 rounded-lg p-3 hover:border-violet-200 hover:bg-violet-50 transition-colors bg-white">
                   <div class="flex justify-between items-start mb-1">
                       <span class="text-xs font-semibold text-gray-500">
                           {formatDistanceToNow(snap.createdAt)} ago
                       </span>
                   </div>
                   <p class="text-sm font-medium text-gray-900 mb-2">{snap.reason}</p>
                   <div class="text-xs text-gray-400 mb-3 font-mono">
                       {snap.contentMd.length} chars
                   </div>
                   <Button variant="secondary" class="w-full justify-center text-xs h-8" onclick={() => restoreSnapshot(snap)}>
                       Restore
                   </Button>
               </div>
            {/each}
            {#if $currentChapterStore.snapshots.length === 0}
                <div class="text-center text-gray-400 text-sm py-8">
                    No snapshots yet.
                </div>
            {/if}
        </div>
     </div>
  </div>
{/if}
