<script lang="ts">
  let { title, subtitle }: { title?: string, subtitle?: string } = $props();
</script>

<div class="mb-8">
  <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
  {#if subtitle}
    <p class="mt-2 text-base text-slate-500 max-w-2xl">{subtitle}</p>
  {/if}
</div>