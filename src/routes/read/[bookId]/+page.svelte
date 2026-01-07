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
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Card from '$lib/ui/components/Card.svelte';
  import ListRow from '$lib/ui/components/ListRow.svelte';
  import SocialActionBar from '$lib/ui/components/social/SocialActionBar.svelte';
  import CommentSection from '$lib/ui/components/social/CommentSection.svelte';
  import Badge from '$lib/ui/components/Badge.svelte';

  const bookId = $page.params.bookId || '';
  const socialStore = createSocialStore(); 

  // Offline State
  let offlineStatus: { pinned: boolean; ready: boolean; error?: string } = { pinned: false, ready: false };
  let isTogglingOffline = false;

  onMount(async () => {
      await currentBookStore.load(bookId || '');
      
      if ($authStore.pubkey) {
          await wotStore.load();
          const pubkey = $authStore.pubkey;
          const d = $currentBookStore.book?.d || bookId;
          
          socialStore.load({ kind: 30003, pubkey, d });
          
          const statusRes = await offlineService.getOfflineStatus(pubkey, d);
          if (statusRes.ok) offlineStatus = statusRes.value;
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
      alert('Zap flow would start here');
  }

</script>

{#if $currentBookStore.book}
  <div class="max-w-2xl mx-auto">
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

      <header class="mb-8 text-center">
          <h1 class="text-4xl font-bold text-slate-900 mb-4">{$currentBookStore.book.title}</h1>
          {#if $currentBookStore.book.summary}
              <p class="text-xl text-slate-500 italic">{$currentBookStore.book.summary}</p>
          {/if}
          
          {#if offlineStatus.pinned}
              <div class="mt-4 flex justify-center">
                  <Badge 
                      status={offlineStatus.ready ? 'success' : 'warning'} 
                      label={offlineStatus.ready ? 'Ready Offline' : 'Caching...'} 
                  />
              </div>
          {/if}
      </header>
      
      <div class="mb-8">
          <SocialActionBar 
              stats={$socialStore} 
              onReact={handleReact}
              onBoost={handleBoost}
              onReply={() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}
              onZap={handleZap}
          />
      </div>

      <Card title="Table of Contents">
          <div class="space-y-2">
              {#each $currentBookStore.chapters as chapter, i}
                  <ListRow 
                      icon="FileText" 
                      title="{i + 1}. {chapter.title}" 
                      subtitle="Read Chapter"
                      onclick={() => goto(`/read/${bookId}/${chapter.id}`)}
                  />
              {/each}
          </div>
      </Card>
      
      <div id="comments">
          <CommentSection 
              comments={$socialStore.replies} 
              onReply={handleReply}
          />
      </div>
  </div>
{:else}
  <div class="text-center py-12 text-slate-500">Loading book...</div>
{/if}
