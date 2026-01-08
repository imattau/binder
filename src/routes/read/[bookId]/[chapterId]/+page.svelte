<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentBookStore } from '$lib/state/currentBookStore';
  import { currentChapterStore } from '$lib/state/currentChapterStore';
  import { createSocialStore } from '$lib/state/socialStore';
  import { wotStore } from '$lib/state/wotStore';
  import { authStore } from '$lib/state/authStore';
import { markdownService } from '$lib/services/markdownService';
import { libraryStore } from '$lib/state/libraryStore';
import { libraryService } from '$lib/services/libraryService';
import { readingProgressStore } from '$lib/state/readingProgressStore';
import { zapModalStore } from '$lib/state/zapModalStore';
import type { LocalBook, LocalChapterDraft, ReadingProgress } from '$lib/domain/types';
import Button from '$lib/ui/components/Button.svelte';
import Icon from '$lib/ui/components/Icon.svelte';
import SocialActionBar from '$lib/ui/components/social/SocialActionBar.svelte';
import CommentSection from '$lib/ui/components/social/CommentSection.svelte';

  const bookId = $page.params.bookId || '';
  const chapterId = $page.params.chapterId || '';
  const chapterEventId = $page.url.searchParams.get('chapterEventId') || undefined;
  
const socialStore = createSocialStore();
let progressQueue: Promise<void> | null = null;
let lastRecordedChapterId = '';

  onMount(async () => {
      await Promise.all([
          currentBookStore.load(bookId || ''),
          currentChapterStore.load(chapterId || '', { chapterEventId })
      ]);
      
      if ($authStore.pubkey) {
          await wotStore.load();
      }

      // Load Social Stats
      let statsPubkey = '';
      let statsD = '';
      
      const targetId = $currentChapterStore.chapter?.id || chapterId;
      if (targetId.includes(':')) {
          const parts = targetId.split(':');
          if (parts.length >= 3) {
              statsPubkey = parts[1];
              statsD = parts.slice(2).join(':');
          }
      }
      
      if (statsPubkey && statsD) {
          socialStore.load({ kind: 30023, pubkey: statsPubkey, d: statsD });
      }
  });

  async function handleReact() {
      if (!$currentChapterStore.chapter || !$authStore.pubkey) return;
      const coords = { kind: 30023, pubkey: $authStore.pubkey, d: $currentChapterStore.chapter.d };
      const res = await socialStore.react(coords);
      if (!res.ok) {
          console.warn('Reaction failed', res.error);
      }
  }

  async function handleBoost() {
      if (!$currentChapterStore.chapter || !$authStore.pubkey) return;
      const coords = { kind: 30023, pubkey: $authStore.pubkey, d: $currentChapterStore.chapter.d };
      const res = await socialStore.boost(coords);
      if (!res.ok) {
          console.warn('Boost failed', res.error);
      }
  }

   async function handleReply(content: string) {
        if (!$currentChapterStore.chapter || !$authStore.pubkey) return;
        const coords = { kind: 30023, pubkey: $authStore.pubkey, d: $currentChapterStore.chapter.d };
        const res = await socialStore.reply(coords, content);
        if (!res.ok) {
            console.warn('Reply failed', res.error);
        }
   }
  
  async function handleZap() {
       if (!$currentChapterStore.chapter) return;
       const chapter = $currentChapterStore.chapter;
       
       let pubkey = chapter.pubkey;
       let coordinates = chapter.id;

       if (!pubkey && chapter.id.includes(':')) {
          pubkey = chapter.id.split(':')[1];
       }
       
       if (!pubkey) {
           alert('Author public key is unavailable.');
           return;
       }

      zapModalStore.open({
          type: 'event',
          pubkey,
          coordinates: chapter.id.includes(':') ? chapter.id : `${30023}:${pubkey}:${chapter.d}`,
      }, `Chapter: ${chapter.title}`);
  }

  $effect(() => {
      if (
          !$authStore.pubkey ||
          !$currentChapterStore.chapter ||
          !$currentBookStore.book ||
          $currentBookStore.chapters.length === 0
      ) {
          return;
      }

      const chapter = $currentChapterStore.chapter;
      const book = $currentBookStore.book;
      const idx = $currentBookStore.chapters.findIndex(c => c.id === chapter.id);
      if (idx >= 0 && chapter.id !== lastRecordedChapterId && !progressQueue) {
          const total = Math.max(1, $currentBookStore.chapters.length);
          const percent = Math.min(100, Math.round(((idx + 1) / total) * 100));
          progressQueue = recordProgress(book, chapter, percent)
              .then(() => {
                  lastRecordedChapterId = chapter.id;
              })
              .catch((error) => {
                  console.error('Reading progress update failed', error);
              })
              .finally(() => {
                  progressQueue = null;
              });
      }
  });

  async function recordProgress(book: LocalBook, chapter: LocalChapterDraft, percent: number) {
      const progress: ReadingProgress = {
          bookId: book.id,
          lastChapterId: chapter.id,
          percent,
          updatedAt: Date.now()
      };

      await libraryService.updateProgress(book.id, chapter.id, percent);
      readingProgressStore.setProgress(book.id, progress);
      await syncShelves(book, percent);
  }

  async function syncShelves(book: LocalBook, percent: number) {
      if (!book.id.includes(':')) return;
      const parts = book.id.split(':');
      if (parts.length < 3) return;
      const kind = Number(parts[0]);
      if (Number.isNaN(kind)) return;
      const pubkey = parts[1];
      const d = parts.slice(2).join(':');

      const meta = {
          kind,
          pubkey,
          d,
          title: book.title,
          summary: book.summary
      };

      try {
          if (percent >= 100) {
              await libraryService.saveBookToLibrary(meta, 'finished');
              await libraryService.removeBookFromShelf(book.id, 'reading');
          } else if (percent > 0) {
              await libraryService.saveBookToLibrary(meta, 'reading');
              await libraryService.removeBookFromShelf(book.id, 'finished');
          }

          const savedRes = await libraryService.getSavedBook(book.id);
          if (savedRes.ok && savedRes.value) {
              libraryStore.upsertBook(savedRes.value);
          }
      } catch (error) {
          console.warn('Shelf sync failed', error);
      }
  }

</script>

{#if $currentChapterStore.chapter}
  <div class="max-w-3xl mx-auto py-8 px-4">
      <div class="mb-6 flex justify-between items-center">
          <Button variant="secondary" onclick={() => goto(`/read/${bookId}`)}>
             <div class="flex items-center gap-2">
                 <Icon name="ArrowLeft" /> Table of Contents
             </div>
          </Button>
      </div>

      <article class="prose prose-lg max-w-none mb-12">
          <h1 class="mb-2">{$currentChapterStore.chapter.title}</h1>
          {#if !$authStore.pubkey}
              <div class="text-sm text-slate-500 mb-8 border-b border-slate-100 pb-4 italic">
                   Viewed as Guest
              </div>
          {/if}
          
          {@html markdownService.render($currentChapterStore.chapter.contentMd)}
      </article>

      <div class="border-t border-slate-100 pt-8">
          <SocialActionBar 
              stats={$socialStore} 
              onReact={handleReact}
              onBoost={handleBoost}
              onReply={() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}
              onZap={handleZap}
          />
          
          <div id="comments">
              <CommentSection 
                  comments={$socialStore.replies} 
                  onReply={handleReply}
              />
          </div>
      </div>
  </div>
{:else}
  {#if $currentChapterStore.loading}
    <div class="text-center py-12 text-slate-500">Loading chapter...</div>
  {:else if $currentChapterStore.loadError}
    <div class="text-center py-12 text-red-500">{$currentChapterStore.loadError}</div>
  {:else}
    <div class="text-center py-12 text-slate-500">Chapter unavailable.</div>
  {/if}
{/if}
