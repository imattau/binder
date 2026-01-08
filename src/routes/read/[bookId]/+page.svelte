<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentBookStore } from '$lib/state/currentBookStore';
  import { createSocialStore } from '$lib/state/socialStore';
  import { wotStore } from '$lib/state/wotStore';
  import { authStore } from '$lib/state/authStore';
  import { offlineService } from '$lib/services/offlineService';
  import { exportService } from '$lib/services/exportService';
  import { profileService } from '$lib/services/profileService';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Card from '$lib/ui/components/Card.svelte';
  import ListRow from '$lib/ui/components/ListRow.svelte';
  import SocialActionBar from '$lib/ui/components/social/SocialActionBar.svelte';
  import CommentSection from '$lib/ui/components/social/CommentSection.svelte';
  import Badge from '$lib/ui/components/Badge.svelte';
  import { zapModalStore } from '$lib/state/zapModalStore';
  import { readingProgressStore } from '$lib/state/readingProgressStore';
  import type { ReadingProgress, AuthorProfile } from '$lib/domain/types';

  const bookId = $page.params.bookId || '';
  const socialStore = createSocialStore(); 

  // Offline State
  let offlineStatus = $state<{ pinned: boolean, ready: boolean, error?: string }>({ pinned: false, ready: false });
  let isTogglingOffline = $state(false);
  let progressTarget = '';
  let lastReadIndex = $state(-1);
  let bookProgress = $state<ReadingProgress | undefined>(undefined);
  let authorProfile = $state<Partial<AuthorProfile> | null>(null);

  onMount(async () => {
      await currentBookStore.load(bookId || '');
      
      if ($currentBookStore.book?.id.includes(':')) {
          const pubkey = $currentBookStore.book.id.split(':')[1];
          if (pubkey) {
              const profileRes = await profileService.loadProfile(pubkey);
              if (profileRes.ok) {
                  authorProfile = profileRes.value;
              }
          }
      }
      
      if ($authStore.pubkey) {
          await wotStore.load();
          // Offline status checks only if logged in
          const d = $currentBookStore.book?.d || (bookId.includes(':') ? bookId.split(':')[2] : bookId);
          // If we are viewing a specific book (remote), we can try to check offline status
          // The offline service might need the author pubkey too if it pins by address?
          // offlineService.getOfflineStatus expects (pubkey, d).
          // If it's a remote book, we pin it by Author:D. 
          // If local, it's just D? Local books aren't pinned, they ARE local.
          
          // Actually, offline pinning is for REMOTE books.
          let authorPubkey = '';
          if (bookId.includes(':')) {
             authorPubkey = bookId.split(':')[1];
          }
          
          if (authorPubkey) {
             const statusRes = await offlineService.getOfflineStatus(authorPubkey, d);
             if (statusRes.ok) offlineStatus = statusRes.value;
          }
      }

      // Load Social Stats (Public)
      let statsPubkey = '';
      let statsD = '';
      
      if (bookId.includes(':')) {
          const parts = bookId.split(':');
          statsPubkey = parts[1];
          statsD = parts[2];
      } else if ($currentBookStore.book?.id.includes(':')) {
          const parts = $currentBookStore.book.id.split(':')[1]; // Bug in split usage in my thought? string.split returns array.
          // Correct: 
          const p = $currentBookStore.book.id.split(':');
          statsPubkey = p[1];
          statsD = p[2];
      }
      
      if (statsPubkey && statsD) {
          socialStore.load({ kind: 30003, pubkey: statsPubkey, d: statsD });
      }
  });

  $effect(() => {
      if ($authStore.pubkey && bookId) {
          const targetKey = `${bookId}:${$authStore.pubkey}`;
          if (progressTarget !== targetKey) {
              progressTarget = targetKey;
              void readingProgressStore.load(bookId);
          }
          return;
      }
      if (progressTarget) {
          progressTarget = '';
      }
  });

  $effect(() => {
      bookProgress = $readingProgressStore[bookId];
  });

  $effect(() => {
      const progress = bookProgress;
      if (progress && $currentBookStore.chapters.length > 0) {
          const idx = $currentBookStore.chapters.findIndex(ch => ch.id === progress.lastChapterId);
          if (idx >= 0) {
              lastReadIndex = idx;
          } else if (progress.percent > 0) {
              lastReadIndex = Math.max(-1, Math.floor(($currentBookStore.chapters.length * progress.percent) / 100) - 1);
          } else {
              lastReadIndex = -1;
          }
      } else {
          lastReadIndex = -1;
      }
  });
  
  async function toggleOffline() {
      if (!$currentBookStore.book || !$authStore.pubkey) return;
      isTogglingOffline = true;
      
      const pubkey = $authStore.pubkey;
      const d = $currentBookStore.book.d;
      
      if (offlineStatus.pinned) {
          await offlineService.unpinBook(pubkey, d);
          offlineStatus = { pinned: false, ready: false };
      } else {
          await offlineService.pinBook(pubkey, d);
          offlineStatus = { pinned: true, ready: false };
      }
      isTogglingOffline = false;
  }

  async function handleExport() {
      if (!$currentBookStore.book || !$authStore.pubkey) return;
      await exportService.exportBookAsHtml($authStore.pubkey, $currentBookStore.book.d);
  }

  async function handleReact() {
      if (!$currentBookStore.book || !$authStore.pubkey) return;
      const coords = { kind: 30003, pubkey: $authStore.pubkey, d: $currentBookStore.book.d };
      await socialStore.react(coords);
  }

  async function handleBoost() {
      if (!$currentBookStore.book || !$authStore.pubkey) return;
      const coords = { kind: 30003, pubkey: $authStore.pubkey, d: $currentBookStore.book.d };
      await socialStore.boost(coords);
  }

  async function handleReply(content: string) {
       if (!$currentBookStore.book || !$authStore.pubkey) return;
       const coords = { kind: 30003, pubkey: $authStore.pubkey, d: $currentBookStore.book.d };
       await socialStore.reply(coords, content);
       await socialStore.load(coords);
  }

  async function handleZap() {
      if (!$currentBookStore.book) return;
      const book = $currentBookStore.book;
      if (!book.id.includes(':')) {
          alert('Zap is only supported for published books.');
          return;
      }

      const parts = book.id.split(':');
      if (parts.length < 2) {
          alert('Zap is only supported for published books.');
          return;
      }

      const authorPubkey = parts[1];
      
      zapModalStore.open({
          type: 'event',
          pubkey: authorPubkey,
          coordinates: book.id,
      }, `Book: ${book.title}`);
  }

</script>

{#if $currentBookStore.book}
  <div class="max-w-5xl mx-auto">
      <div class="mb-8 flex justify-between items-center">
          <Button variant="secondary" onclick={() => goto('/discover')}>
             <div class="flex items-center gap-2">
                 <Icon name="ArrowLeft" /> Back
             </div>
          </Button>
          
          {#if $authStore.pubkey}
            <div class="flex gap-2">
                <Button variant="secondary" onclick={handleExport}>
                    <div class="flex items-center gap-2">
                        <Icon name="Export" /> Export HTML
                    </div>
                </Button>
                
                <Button 
                    variant={offlineStatus.pinned ? 'primary' : 'secondary'} 
                    onclick={toggleOffline}
                    disabled={isTogglingOffline}
                >
                    <div class="flex items-center gap-2">
                        <Icon name={offlineStatus.pinned ? 'CloudArrowDown' : 'CloudSlash'} />
                        {offlineStatus.pinned ? 'Available Offline' : 'Pin Offline'}
                    </div>
                </Button>
            </div>
          {/if}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <!-- Left Column: Cover & Actions -->
          <div class="space-y-6">
              {#if $currentBookStore.book.cover}
                  <div class="aspect-[2/3] w-full relative rounded-lg shadow-xl overflow-hidden bg-slate-100">
                      <img 
                          src={$currentBookStore.book.cover} 
                          alt="Cover" 
                          class="absolute inset-0 h-full w-full object-cover"
                      />
                  </div>
              {:else}
                  <div class="aspect-[2/3] w-full rounded-lg shadow-md bg-slate-100 flex items-center justify-center text-slate-300">
                      <Icon name="BookOpen" size={64} />
                  </div>
              {/if}

              <SocialActionBar 
                  stats={$socialStore} 
                  onReact={handleReact}
                  onBoost={handleBoost}
                  onReply={() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}
                  onZap={handleZap}
              />
          </div>

          <!-- Right Column: Details & TOC -->
          <div class="md:col-span-2 space-y-8">
              <div>
                  <h1 class="text-4xl font-bold text-slate-900 mb-4 leading-tight">{$currentBookStore.book.title}</h1>
                  
                  {#if authorProfile}
                      <div class="flex items-center gap-3 mb-6">
                          {#if authorProfile.picture}
                              <img src={authorProfile.picture} alt={authorProfile.name} class="h-12 w-12 rounded-full bg-slate-100 object-cover ring-2 ring-white shadow-sm" />
                          {/if}
                          <div>
                              <p class="font-medium text-slate-900 text-lg">{authorProfile.displayName || authorProfile.name || 'Unknown Author'}</p>
                              {#if $authStore.pubkey && $currentBookStore.book.id.includes(':') && $wotStore.follows.has($currentBookStore.book.id.split(':')[1])}
                                  <Badge status="success" label="Following" />
                              {/if}
                          </div>
                      </div>
                  {/if}

                  {#if $currentBookStore.book.summary}
                      <p class="text-lg text-slate-600 leading-relaxed">{$currentBookStore.book.summary}</p>
                  {/if}
                  
                  {#if offlineStatus.pinned}
                      <div class="mt-4">
                          <Badge 
                              status={offlineStatus.ready ? 'success' : 'warning'} 
                              label={offlineStatus.ready ? 'Ready Offline' : 'Caching...'} 
                          />
                      </div>
                  {/if}
              </div>

              <Card title="Table of Contents">
                  {#if $authStore.pubkey && bookProgress}
                      <div class="mb-4 flex items-center justify-between text-xs text-slate-500">
                          <span>
                              Progress: {bookProgress.percent}% read
                              {#if lastReadIndex >= 0}
                                  • Last read: Chapter {lastReadIndex + 1}
                              {/if}
                          </span>
                          <Badge 
                              status={bookProgress.percent === 100 ? 'success' : 'warning'} 
                              label={bookProgress.percent === 100 ? 'Finished' : 'Reading'} 
                          />
                      </div>
                  {/if}
                  <div class="space-y-2">
                      {#each $currentBookStore.chapters as chapter, i}
                          <ListRow 
                              icon="FileText" 
                              title={`${i + 1}. ${chapter.title}`} 
                              subtitle="Read Chapter"
                              onclick={() => goto(`/read/${bookId}/${chapter.id}`)}
                          >
                              {#snippet actions()}
                                  {#if $authStore.pubkey && lastReadIndex >= i}
                                      <Badge status="success" label="Read" />
                                  {/if}
                              {/snippet}
                          </ListRow>
                      {/each}
                  </div>
              </Card>
          </div>
      </div>
      
      <div id="comments" class="max-w-3xl">
          <h3 class="text-xl font-bold text-slate-900 mb-6">Comments & Discussion</h3>
          <CommentSection 
              comments={$socialStore.replies} 
              onReply={handleReply}
          />
      </div>
  </div>
{:else}
  <div class="text-center py-12 text-slate-500">Loading book...</div>
{/if}
