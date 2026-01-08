<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './iconTypes';
  import Button from './Button.svelte';

  let { 
    icon, 
    title, 
    description, 
    actionLabel, 
    onaction 
  }: {
    icon: IconName,
    title: string,
    description: string,
    actionLabel?: string,
    onaction?: () => void
  } = $props();
</script>

<div class="text-center py-12 px-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
  <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 mb-4">
    <Icon name={icon} size={24} class="text-indigo-600" />
  </div>
  <h3 class="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
  <p class="mt-1 text-sm text-gray-500">{description}</p>
  
  {#if actionLabel && onaction}
    <div class="mt-6">
      <Button onclick={onaction}>
        <div class="flex items-center gap-2">
            <Icon name="Plus" />
            {actionLabel}
        </div>
      </Button>
    </div>
  {/if}
</div>