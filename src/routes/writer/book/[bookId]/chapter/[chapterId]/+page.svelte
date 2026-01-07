<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
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

  const bookId = $page.params.bookId || '';
  const chapterId = $page.params.chapterId || '';
  
  let isEditingTitle = false;
  let editTitle = '';
  let autoSaveTimer: ReturnType<typeof setTimeout>;
  let codeMirrorRef: {
    wrapSelection?: (prefix: string, suffix?: string, placeholder?: string) => void;
    insertAtLineStart?: (prefix: string) => void;
  } | null = null;
  let imageInput: HTMLInputElement | null = null;
  let isUploadingImage = false;
  let imageUploadError = '';

  onMount(() => {
    if (!$authStore.pubkey) {
        goto('/login');
        return;
    }
    if (chapterId) {
        currentChapterStore.load(chapterId);
    }
  });
  
  onDestroy(() => {
      clearTimeout(autoSaveTimer);
      // Final save on exit if dirty
      if ($currentChapterStore.isDirty) {
          currentChapterStore.save();
      }
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
      alert('Snapshot created!');
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
                 <Button variant="secondary" onclick={handleSnapshot}>
                    <Icon name="ClockCounterClockwise" />
                 </Button>
                 <Button 
                    variant={$editorUiStore.pane === 'preview' ? 'ghost' : 'secondary'}
                    onclick={() => setEditorPane('preview')}
                 >
                    <div class="flex items-center gap-2">
                        <Icon name="Eye" />
                        Review
                    </div>
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
