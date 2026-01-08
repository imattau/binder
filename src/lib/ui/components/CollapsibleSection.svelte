<script lang="ts">
  export let title: string;
  export let description: string | undefined;
  export let startOpen = false;
  let open = startOpen;

  function toggle() {
    open = !open;
  }
</script>

<div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
  <button
    type="button"
    class="flex w-full items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    aria-expanded={open}
    onclick={toggle}
  >
    <div>
      <p class="text-sm font-semibold text-slate-900">{title}</p>
      {#if description}
        <p class="text-xs text-slate-500">{description}</p>
      {/if}
    </div>
    <span
      class={`text-xs uppercase tracking-widest text-slate-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      ▸
    </span>
  </button>
  <div
    class="overflow-hidden transition-all duration-200"
    style={`max-height: ${open ? '1000px' : '0'}; opacity: ${open ? 1 : 0};`}
  >
    <div class="px-5 pb-5 pt-0">
      <slot />
    </div>
  </div>
</div>
