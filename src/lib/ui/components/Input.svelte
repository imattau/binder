<script lang="ts">
  let { 
    value = $bindable(), 
    ref = $bindable(),
    ...rest
  } = $props();
</script>

<input
  bind:this={ref}
  bind:value
  {...rest}
  class="
    block w-full rounded-lg border-slate-200 shadow-sm transition-colors duration-200
    placeholder:text-slate-400
    focus:border-violet-500 focus:ring-violet-500 sm:text-sm
    disabled:bg-slate-50 disabled:text-slate-500
    py-2.5 px-3
    {rest.class || ''}
  "
/>