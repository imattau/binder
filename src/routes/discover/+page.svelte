<script lang="ts">
  import { onMount } from 'svelte';
  import { discoverStore } from '$lib/state/discoverStore';
  import { authStore } from '$lib/state/authStore';
  import { bookLayoutStore } from '$lib/state/bookLayoutStore';
  import SectionHeader from '$lib/ui/components/SectionHeader.svelte';
  import LayoutToggle from '$lib/ui/components/LayoutToggle.svelte';
  import BookCard from '$lib/ui/components/discovery/BookCard.svelte';
  import AuthorGroup from '$lib/ui/components/discovery/AuthorGroup.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';
  import Button from '$lib/ui/components/Button.svelte';
  import EmptyState from '$lib/ui/components/EmptyState.svelte';
  import { goto } from '$app/navigation';
  import { formatDistanceToNow } from 'date-fns';
  import type { NostrEvent } from 'nostr-tools';
  import { pageConfigService } from '$lib/services/pageConfigService';

  const pageConfig = pageConfigService.getConfig();

  onMount(() => {
    discoverStore.load();
  });

  $: networkBooks = $discoverStore.network;
  $: newAuthors = (() => {
    const seen = new Set();
    return networkBooks
      .filter(item => {
        const key = item.event.pubkey;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  })();
  $: hotReads = (() => {
    return [...networkBooks]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 4);
  })();

  const getTagValue = (event: NostrEvent, key: string) => event.tags.find(t => t[0] === key)?.[1];

  function getBookTitle(event: NostrEvent) {
    return getTagValue(event, 'title') || 'Untitled';
  }

  function getBookSummary(event: NostrEvent) {
    return getTagValue(event, 'summary') || '';
  }

  function getBookD(event: NostrEvent) {
    return getTagValue(event, 'd') || '';
  }

  function getCoordinate(event: NostrEvent) {
    const d = getBookD(event);
    return `${event.kind}:${event.pubkey}:${d}`;
  }

</script>

  <div class="space-y-12">
    {#if pageConfig.coverImage}
      <section class="overflow-hidden rounded-3xl border border-white/30 bg-white/5 shadow-2xl shadow-slate-900/10">
        <div class="relative h-52 sm:h-64">
          <img
            src={pageConfig.coverImage}
            alt="Binder cover"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-transparent"></div>
        </div>
        <div class="px-6 py-6 sm:px-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-3">
            {#if pageConfig.iconImage}
              <img src={pageConfig.iconImage} alt="Binder icon" class="h-16 w-16 rounded-2xl border border-slate-200 object-cover shadow-lg" />
            {/if}
            <div>
              <p class="text-xs uppercase tracking-[0.4em] text-slate-500">Binder</p>
              <h1 class="text-2xl font-semibold text-slate-900">Long-form books, curated for you</h1>
              <p class="text-sm text-slate-500 mt-1 max-w-xl">Discover stories and knowledge shared by writers across Nostr.</p>
            </div>
          </div>
          <Button variant="secondary" class="hidden lg:inline-flex items-center gap-2" onclick={() => goto('/writer')}>
            <Icon name="PencilSimple" size={16} />
            Publish Your Book
          </Button>
        </div>
      </section>
    {/if}
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <SectionHeader 
          title="Discover" 
          subtitle="Explore long-form books and chapters from across the Nostr network."
        />
        <div class="flex items-center gap-3">
            <LayoutToggle />
            {#if $authStore.pubkey}
              <Button variant="secondary" onclick={() => discoverStore.load(true)} disabled={$discoverStore.loading}>
                  <div class="flex items-center gap-2">
                      <Icon name="ArrowsClockwise" class={$discoverStore.loading ? 'animate-spin' : ''} />
                      Refresh
                  </div>
              </Button>
            {/if}
        </div>
    </div>
  
  {#if !$authStore.pubkey}
      <!-- Guest View -->
      <section>
          <div class="flex items-center gap-2 mb-4">
              <Icon name="Globe" class="text-violet-500" />
              <h2 class="text-lg font-bold text-slate-900">Latest on Binder</h2>
          </div>
          
          {#if $discoverStore.loading && $discoverStore.global.length === 0}
              <div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
                  <Icon name="Pulse" class="animate-spin text-violet-500" size={32} />
                  <span>Scanning relays...</span>
              </div>
          {:else if $discoverStore.global.length > 0}
              {#if $bookLayoutStore === 'grid'}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {#each $discoverStore.global as item}
                          <BookCard {item} annotationCount={$discoverStore.annotations[getBookD(item.event)] ?? 0} />
                      {/each}
                  </div>
              {:else}
                  <div class="space-y-3">
                      {#each $discoverStore.global as item}
                          <button
                              class="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-violet-100"
                              on:click={() => goto(`/read/${getCoordinate(item.event)}`)}
                          >
                              <div class="flex-1">
                                  <p class="font-semibold text-slate-900 line-clamp-2">{getBookTitle(item.event)}</p>
                                  {#if getBookSummary(item.event)}
                                      <p class="text-sm text-slate-500 mt-1 line-clamp-2">{getBookSummary(item.event)}</p>
                                  {/if}
                                  <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                      {formatDistanceToNow(new Date(item.event.created_at * 1000), { addSuffix: true })}
                                  </p>
                              </div>
                              <Icon name="ArrowRight" class="text-slate-300" />
                          </button>
                      {/each}
                  </div>
              {/if}
          {:else}
              <div class="max-w-2xl mx-auto py-8">
                  <EmptyState 
                    icon="Books" 
                    title="No books found" 
                    description="We couldn't find any books on the relays. Try again later or sign in." 
                    actionLabel="Go to Login"
                    onaction={() => goto('/login')}
                  />
              </div>
          {/if}
          
          <!-- Call to Action -->
          <div class="mt-12 bg-violet-50 rounded-xl p-8 text-center border border-violet-100">
              <h3 class="text-xl font-bold text-violet-900 mb-2">Build your library</h3>
              <p class="text-violet-700 mb-6">Sign in to see books from your network, save your favorites, and publish your own work.</p>
              <Button onclick={() => goto('/login')}>Sign In to Binder</Button>
          </div>
      </section>

  {:else if $discoverStore.loading && $discoverStore.chapters.length === 0}
      <!-- Authenticated Loading -->
      <div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
          <Icon name="Pulse" class="animate-spin text-violet-500" size={32} />
          <span>Scanning relays...</span>
      </div>
  {:else}
      <!-- Authenticated Sections -->
      
      {#if newAuthors.length > 0}
          <section class="space-y-4">
              <div class="flex items-center justify-between">
                  <div>
                      <h2 class="text-lg font-bold text-slate-900">New Authors</h2>
                      <p class="text-xs text-slate-500">Authors publishing their first book on Binder.</p>
                  </div>
                  <a href="/writer" class="text-xs text-violet-600 hover:underline">Write on Binder</a>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {#each newAuthors as item}
                      <BookCard {item} annotationCount={$discoverStore.annotations[getBookD(item.event)] ?? 0} />
                  {/each}
              </div>
          </section>
      {/if}

      {#if hotReads.length > 0}
          <section class="space-y-4">
              <div class="flex items-center justify-between">
                  <div>
                      <h2 class="text-lg font-bold text-slate-900">Hot Reads</h2>
                      <p class="text-xs text-slate-500">Trending books weighted by likes, comments, boosts, and zaps.</p>
                  </div>
                  <Button variant="ghost" onclick={() => discoverStore.load(true)} disabled={$discoverStore.loading}>
                      Refresh
                  </Button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {#each hotReads as item}
                      <BookCard {item} annotationCount={$discoverStore.annotations[getBookD(item.event)] ?? 0} />
                  {/each}
              </div>
          </section>
      {/if}

      {#if $discoverStore.network.length > 0}
          <section>
              <div class="flex items-center gap-2 mb-4">
                  <Icon name="Pulse" class="text-violet-500" />
                  <h2 class="text-lg font-bold text-slate-900">Trusted by your network</h2>
              </div>
              {#if $bookLayoutStore === 'grid'}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {#each $discoverStore.network as item}
                          <BookCard {item} annotationCount={$discoverStore.annotations[getBookD(item.event)] ?? 0} />
                      {/each}
                  </div>
              {:else}
                  <div class="space-y-3">
                      {#each $discoverStore.network as item}
                          <button
                              class="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-violet-100"
                              on:click={() => goto(`/read/${getCoordinate(item.event)}`)}
                          >
                              <div class="flex-1">
                                  <p class="font-semibold text-slate-900 line-clamp-2">{getBookTitle(item.event)}</p>
                                  {#if getBookSummary(item.event)}
                                      <p class="text-sm text-slate-500 mt-1 line-clamp-2">{getBookSummary(item.event)}</p>
                                  {/if}
                                  <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                      {formatDistanceToNow(new Date(item.event.created_at * 1000), { addSuffix: true })}
                                  </p>
                              </div>
                              <Icon name="ArrowRight" class="text-slate-300" />
                          </button>
                      {/each}
                  </div>
              {/if}
          </section>
      {/if}

      {#if $discoverStore.books.length > 0}
          <section>
              <div class="flex items-center gap-2 mb-4">
                  <Icon name="BookOpen" class="text-violet-500" />
                  <h2 class="text-lg font-bold text-slate-900">New Books from Follows</h2>
              </div>
              {#if $bookLayoutStore === 'grid'}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {#each $discoverStore.books as item}
                          <BookCard {item} annotationCount={$discoverStore.annotations[getBookD(item.event)] ?? 0} />
                      {/each}
                  </div>
              {:else}
                  <div class="space-y-3">
                      {#each $discoverStore.books as item}
                          <button
                              class="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-violet-100"
                              on:click={() => goto(`/read/${getCoordinate(item.event)}`)}
                          >
                              <div class="flex-1">
                                  <p class="font-semibold text-slate-900 line-clamp-2">{getBookTitle(item.event)}</p>
                                  {#if getBookSummary(item.event)}
                                      <p class="text-sm text-slate-500 mt-1 line-clamp-2">{getBookSummary(item.event)}</p>
                                  {/if}
                                  <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                      {formatDistanceToNow(new Date(item.event.created_at * 1000), { addSuffix: true })}
                                  </p>
                              </div>
                              <Icon name="ArrowRight" class="text-slate-300" />
                          </button>
                      {/each}
                  </div>
              {/if}
          </section>
      {/if}

      <section>
          <div class="flex items-center gap-2 mb-4">
              <Icon name="FileText" class="text-violet-500" />
              <h2 class="text-lg font-bold text-slate-900">Latest Chapters</h2>
          </div>
          {#if $discoverStore.chapters.length === 0 && !$discoverStore.loading}
               <div class="text-center py-8 bg-slate-50 rounded-lg text-slate-500 text-sm border border-slate-100">
                   No new chapters found. Follow more authors to see updates here.
               </div>
          {:else}
              <div class="space-y-6">
                  {#each $discoverStore.chapters as group}
                      <AuthorGroup {group} layoutMode={$bookLayoutStore} />
                  {/each}
              </div>
          {/if}
      </section>
  {/if}
</div>
