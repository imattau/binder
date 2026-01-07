<script lang="ts">
  import Button from '../Button.svelte';
  import type { NostrEvent } from 'nostr-tools';
  import { wotStore } from '$lib/state/wotStore';
  import { wotService } from '$lib/services/wotService';

  export let comments: NostrEvent[] = [];
  export let onReply: (comment: string) => void;

  let newComment = '';

  function handleSubmit() {
      if (!newComment.trim()) return;
      onReply(newComment);
      newComment = '';
  }

  // WoT Filtering
  // Sort by trust score (high to low), then time
  // Collapse if score < 0 (muted) or maybe 0 (unknown) if strict mode
  
  function getScore(event: NostrEvent) {
      return wotService.getTrustScore(event.pubkey, $wotStore);
  }

  $: sortedComments = [...comments].sort((a, b) => {
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.created_at - a.created_at;
  });
</script>

<div class="mt-8">
  <h3 class="text-lg font-bold text-gray-900 mb-4">Comments ({comments.length})</h3>

  <div class="mb-6 flex gap-2">
      <input 
          class="flex-1 border border-gray-300 rounded-md p-2 text-sm"
          placeholder="Write a reply..." 
          bind:value={newComment}
      />
      <Button onclick={handleSubmit} disabled={!newComment.trim()}>Reply</Button>
  </div>

  <div class="space-y-4">
      {#each sortedComments as comment}
          {@const score = getScore(comment)}
          {@const isLowTrust = score < 0} <!-- Muted -->
          
          <div class="p-4 bg-white border border-gray-100 rounded-lg {isLowTrust ? 'opacity-50' : ''}">
              <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                      <div class="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-mono text-indigo-700">
                          {comment.pubkey.slice(0, 2)}
                      </div>
                      <span class="text-xs text-gray-500 font-mono truncate max-w-[100px]">{comment.pubkey}</span>
                      {#if score > 0}
                          <span class="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">Follows</span>
                      {/if}
                      {#if isLowTrust}
                           <span class="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">Muted</span>
                      {/if}
                  </div>
                  <span class="text-xs text-gray-400">{new Date(comment.created_at * 1000).toLocaleDateString()}</span>
              </div>
              
              {#if isLowTrust}
                  <details>
                      <summary class="text-xs text-gray-500 cursor-pointer select-none">Show hidden comment</summary>
                      <p class="mt-2 text-sm text-gray-700">{comment.content}</p>
                  </details>
              {:else}
                  <p class="text-sm text-gray-700">{comment.content}</p>
              {/if}
          </div>
      {/each}
  </div>
</div>
