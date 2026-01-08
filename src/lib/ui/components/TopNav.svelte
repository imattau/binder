<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/state/authStore';
  import { authService } from '$lib/services/authService';
  import { pageConfigStore } from '$lib/state/pageConfigStore';
  import Icon from './Icon.svelte';
  let showMobileMenu = $state(false);

  const isActive = (path: string) => $page.url.pathname.startsWith(path);

  function viewerInitials() {
    const name = $authStore.profile?.name;
    if (name) {
      return name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return $authStore.pubkey ? $authStore.pubkey.slice(0, 2).toUpperCase() : 'GU';
  }

  function viewerLabel() {
    const name = $authStore.profile?.name;
    if (name) {
      return name;
    }
    return $authStore.pubkey ? `${$authStore.pubkey.slice(0, 6)}…` : 'Guest';
  }
</script>

<nav class="sticky top-0 z-50 w-full border-b top-nav-shell backdrop-blur-md shadow-sm transition-all duration-300">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <!-- Logo -->
      <a href="/discover" class="flex items-center gap-2 group">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md transition-transform group-hover:scale-105 overflow-hidden">
          {#if $pageConfigStore.iconImage}
            <img src={$pageConfigStore.iconImage} alt="Binder icon" class="h-full w-full object-cover" />
          {:else}
            <Icon name="Books" size={20} />
          {/if}
        </div>
        <span class="text-lg font-bold tracking-tight text-slate-900">Binder</span>
      </a>

      <!-- Desktop Nav -->
      <div class="hidden md:flex md:items-center md:space-x-8">
        <a href="/discover" class="text-sm font-medium transition-colors {isActive('/discover') ? 'text-violet-600' : 'text-slate-500 hover:text-slate-900'}">Discover</a>
        
        {#if $authStore.pubkey}
            <a href="/library" class="text-sm font-medium transition-colors {isActive('/library') ? 'text-violet-600' : 'text-slate-500 hover:text-slate-900'}">Library</a>
            <a href="/writer" class="text-sm font-medium transition-colors {isActive('/writer') ? 'text-violet-600' : 'text-slate-500 hover:text-slate-900'}">Write</a>
            {#if $authStore.isAdmin}
                <a href="/admin" class="text-sm font-medium transition-colors {isActive('/admin') ? 'text-amber-600' : 'text-slate-500 hover:text-amber-600'}">Admin</a>
            {/if}
        {/if}
        
        <div class="h-4 w-px bg-slate-200"></div>
        
        <div class="flex items-center space-x-4">
            {#if $authStore.pubkey}
                <div class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {#if $authStore.profile?.picture}
                            <img src={$authStore.profile.picture} alt="Profile" class="h-full w-full rounded-full object-cover" />
                        {:else}
                            {viewerInitials()}
                        {/if}
                    </span>
                    <div class="flex flex-col leading-tight">
                        <span class="text-slate-900 font-semibold">{viewerLabel()}</span>
                        <span class="text-[10px] uppercase tracking-[0.3em] text-slate-400">Connected</span>
                    </div>
                </div>
                <a href="/health" title="System Health" class="text-slate-400 hover:text-slate-600 transition-colors {isActive('/health') ? 'text-violet-600' : ''}">
                    <Icon name="Pulse" size={20} />
                </a>
                <a href="/settings" title="Settings" class="text-slate-400 hover:text-slate-600 transition-colors {isActive('/settings') ? 'text-violet-600' : ''}">
                    <Icon name="Gear" size={20} />
                </a>
                {#if $authStore.isAdmin}
                    <span class="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                        Admin
                    </span>
                {/if}
                <button 
                    onclick={() => authService.logout()} 
                    class="text-xs font-semibold text-slate-500 hover:text-slate-900"
                >
                    Logout
                </button>
            {:else}
                <a href="/login" class="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-transform hover:scale-105 hover:bg-slate-800">
                  Login
                </a>
            {/if}
        </div>
      </div>
      
      <!-- Mobile Menu Button -->
      <button class="md:hidden p-2 text-slate-500" onclick={() => showMobileMenu = !showMobileMenu}>
        <span class="sr-only">Open menu</span>
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
    </div>
  </div>
  {#if showMobileMenu}
  <div class="md:hidden border-t top-nav-mobile backdrop-blur-md shadow-sm">
      <div class="space-y-2 px-4 py-4">
        <a href="/discover" class="block text-sm font-medium text-slate-700 hover:text-slate-900" onclick={() => showMobileMenu = false}>Discover</a>
        {#if $authStore.pubkey}
          <a href="/library" class="block text-sm font-medium text-slate-700 hover:text-slate-900" onclick={() => showMobileMenu = false}>Library</a>
          <a href="/writer" class="block text-sm font-medium text-slate-700 hover:text-slate-900" onclick={() => showMobileMenu = false}>Write</a>
          {#if $authStore.isAdmin}
            <a href="/admin" class="block text-sm font-medium text-amber-600 hover:text-amber-700" onclick={() => showMobileMenu = false}>Admin</a>
          {/if}
          <a href="/health" class="block text-sm font-medium text-slate-500 hover:text-violet-600" onclick={() => showMobileMenu = false}>Health</a>
          <a href="/settings" class="block text-sm font-medium text-slate-500 hover:text-violet-600" onclick={() => showMobileMenu = false}>Settings</a>
          <button class="w-full text-left text-sm font-semibold text-slate-500 hover:text-slate-900" onclick={() => { authService.logout(); showMobileMenu = false; }}>
            Logout
          </button>
        {:else}
          <a href="/login" class="block rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white text-center" onclick={() => showMobileMenu = false}>Login</a>
        {/if}
      </div>
    </div>
  {/if}
</nav>
