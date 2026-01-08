<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './iconTypes';
  import { bookLayoutStore, type BookLayoutMode } from '$lib/state/bookLayoutStore';

  const modeInfo: Record<BookLayoutMode, { label: string; icon: IconName }> = {
    list: { label: 'List', icon: 'ListBullets' },
    grid: { label: 'Grid', icon: 'SquaresFour' }
  };

  let currentMode: BookLayoutMode = 'list';
  let nextMode: BookLayoutMode = 'grid';

  $: currentMode = $bookLayoutStore ?? 'list';
  $: currentInfo = modeInfo[currentMode];
  $: nextMode = currentMode === 'list' ? 'grid' : 'list';

  function toggleLayout() {
    const targetMode: BookLayoutMode = nextMode;
    bookLayoutStore.setLayout(targetMode);
  }
</script>

<div class="inline-flex rounded-full border border-slate-200 bg-white shadow-sm">
  <button
    class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition duration-150 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
    type="button"
    aria-label={`Switch to ${modeInfo[nextMode].label} layout`}
    on:click={toggleLayout}
  >
    <Icon name={currentInfo.icon} size={16} />
    <span class="sr-only">{currentInfo.label} view</span>
  </button>
</div>
