<script lang="ts">
  import Icon from '../Icon.svelte';
  import Button from '../Button.svelte';
  import type { SocialState } from '$lib/state/socialStore';
  
  let { 
      stats, 
      onReact, 
      onBoost, 
      onReply, 
      onZap 
  } = $props();

  // Derived counts
  const reactionCount = $derived(stats.reactions.length);
  const boostCount = $derived(stats.boosts.length);
  const replyCount = $derived(stats.replies.length);
  const zapCount = $derived(stats.zaps.length); // Count of receipts, ideally sum sats
</script>

<div class="flex items-center gap-6 py-4 border-t border-b border-gray-100">
  <button class="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors" onclick={onReact}>
    <Icon name="Heart" /> 
    <span class="text-sm font-medium">{reactionCount}</span>
  </button>
  
  <button class="flex items-center gap-2 text-gray-500 hover:text-green-500 transition-colors" onclick={onBoost}>
    <Icon name="ArrowsClockwise" />
    <span class="text-sm font-medium">{boostCount}</span>
  </button>
  
  <button class="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors" onclick={onReply}>
    <Icon name="ChatCircle" />
    <span class="text-sm font-medium">{replyCount}</span>
  </button>
  
  <button class="flex items-center gap-2 text-gray-500 hover:text-yellow-500 transition-colors" onclick={onZap}>
    <Icon name="Lightning" />
    <span class="text-sm font-medium">{zapCount}</span>
  </button>
</div>
