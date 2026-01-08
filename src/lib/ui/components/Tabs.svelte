<script lang="ts">
  let { items, activeItem, onchange } = $props();
</script>

<div class="border-b border-gray-200">
  <nav class="-mb-px flex space-x-8" aria-label="Tabs">
    {#each items as item}
      <button
        onclick={() => onchange(item.id)}
        class="{activeItem === item.id
          ? 'border-indigo-500 text-indigo-600'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
          whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
        aria-current={activeItem === item.id ? 'page' : undefined}
      >
        {item.label}
      </button>
    {/each}
  </nav>
</div>
