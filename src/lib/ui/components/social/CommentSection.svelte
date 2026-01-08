<script lang="ts">
  import Button from '../Button.svelte';
  import Badge from '../Badge.svelte';
  import type { NostrEvent } from 'nostr-tools';
  import { authStore } from '$lib/state/authStore';
  import { wotStore } from '$lib/state/wotStore';
  import { wotService } from '$lib/services/wotService';
  import { commentMetaService } from '$lib/services/commentMetaService';
  import { moderationService } from '$lib/services/moderationService';
  import type { AuthorProfile } from '$lib/domain/types';

  type CommentProps = {
      comments: NostrEvent[];
      onReply: (value: string) => void;
  };

  let { comments, onReply }: CommentProps = $props();

  let newComment = $state('');
  let mutedThreads = $state(new Set<string>());
  let mutingAuthor = $state<string | null>(null);
  let mutingThread = $state<string | null>(null);
  let reportingId = $state<string | null>(null);

  let flattenedComments = $state<FlattenedComment[]>([]);
  let profiles = $state<Record<string, AuthorProfile>>({});

  type FlattenedComment = {
      event: NostrEvent;
      depth: number;
      rootId: string;
  };
  type ThreadNode = {
      event: NostrEvent;
      children: ThreadNode[];
      rootId?: string;
  };

  function handleSubmit() {
      if (!newComment.trim() || !$authStore.pubkey) return;
      onReply(newComment);
      newComment = '';
  }

  function getScore(event: NostrEvent) {
      return wotService.getTrustScore(event.pubkey, $wotStore);
  }

  $effect(() => {
      const uniquePubkeys = Array.from(new Set<string>(comments.map(c => c.pubkey)));
      void commentMetaService.loadProfiles(uniquePubkeys);
      const nextProfiles: Record<string, AuthorProfile> = {};
      uniquePubkeys.forEach((pubkey) => {
          const profile = commentMetaService.getCachedProfile(pubkey);
          if (profile) nextProfiles[pubkey] = profile;
      });
      profiles = nextProfiles;

      const sortedByTrust = [...comments].sort((a, b) => {
          const scoreA = getScore(a);
          const scoreB = getScore(b);
          if (scoreA !== scoreB) return scoreB - scoreA;
          return b.created_at - a.created_at;
      });

      const threadTree = buildThreadTree(sortedByTrust);
      flattenedComments = flattenTree(threadTree);
  });

  function buildThreadTree(list: NostrEvent[]) {

      const map = new Map<string, ThreadNode>();
      list.forEach(event => map.set(event.id, { event, children: [] }));

      const roots: ThreadNode[] = [];
      list.forEach(event => {
          const node = map.get(event.id)!;
          const parentId = event.tags.find(t => t[0] === 'e')?.[1];
          if (parentId && map.has(parentId) && parentId !== event.id) {
              map.get(parentId)!.children.push(node);
          } else {
              roots.push(node);
          }
      });

      function assignRoot(node: ThreadNode, rootId: string) {
          node.rootId = rootId;
          node.children.forEach(child => assignRoot(child, rootId));
      }

      roots.forEach(root => assignRoot(root, root.event.id));
      return roots;
  }

  function flattenTree(nodes: ThreadNode[]) {
      const flat: FlattenedComment[] = [];

      function walk(node: ThreadNode, depth: number) {
          if (!node.rootId) return;
          flat.push({ event: node.event, depth, rootId: node.rootId });
          node.children.forEach(child => walk(child, depth + 1));
      }

      nodes.forEach(node => walk(node, 0));
      return flat;
  }

  function getProfile(pubkey: string) {
      return profiles[pubkey];
  }

  async function handleMuteAuthor(pubkey: string) {
      if (!pubkey || !$authStore.pubkey) return;
      mutingAuthor = pubkey;
      const res = await moderationService.muteAuthor(pubkey);
      mutingAuthor = null;
      if (res.ok) {
          wotStore.addMute(pubkey);
      } else {
          console.warn('Mute author failed', res.error);
      }
  }

  async function handleMuteThread(rootId: string, author: string) {
      if (!rootId || !$authStore.pubkey) return;
      mutingThread = rootId;
      const res = await moderationService.muteThread(rootId, author);
      mutingThread = null;
      if (res.ok) {
          mutedThreads = new Set([...mutedThreads, rootId]);
          if (author) {
              wotStore.addMute(author);
          }
      } else {
          console.warn('Mute thread failed', res.error);
      }
  }

  function unmuteThread(rootId: string) {
      mutedThreads = new Set([...mutedThreads].filter(id => id !== rootId));
  }

  async function handleReport(comment: NostrEvent) {
      if (!comment.pubkey) return;
      const reason = prompt('Report this comment (optional explanation):', '');
      if (!reason) return;
      reportingId = comment.id;
      const res = await moderationService.reportComment(comment.id, comment.pubkey, reason);
      reportingId = null;
      if (res.ok) {
          alert('Report sent to your WoT');
      } else {
          console.warn('Report failed', res.error);
      }
  }
</script>

<div class="mt-8">
  <h3 class="text-lg font-bold text-gray-900 mb-4">Comments ({comments.length})</h3>

  {#if $authStore.pubkey}
      <div class="mb-6 flex gap-2">
          <input 
              class="flex-1 border border-gray-300 rounded-md p-2 text-sm"
              placeholder="Write a reply..." 
              bind:value={newComment}
          />
          <Button onclick={handleSubmit} disabled={!newComment.trim()}>Reply</Button>
      </div>
  {:else}
      <div class="mb-6 text-xs text-gray-500">
          Sign in to add a comment.
      </div>
  {/if}

  <div class="space-y-4">
      {#each flattenedComments as entry (entry.event.id)}
          {@const profile = getProfile(entry.event.pubkey)}
          {@const score = getScore(entry.event)}
          {@const isMutedThread = mutedThreads.has(entry.rootId)}
          {@const isLowTrust = score < 0}

          {#if isMutedThread}
              {#if entry.depth === 0}
                  <div class="p-4 border border-gray-100 rounded-lg bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
                      <span>Thread muted</span>
                      <button
                          class="text-emerald-600 underline text-xs"
                          onclick={() => unmuteThread(entry.rootId)}
                      >Show thread</button>
                  </div>
              {/if}
          {:else}
              <div
                  class={`p-4 bg-white border border-gray-100 rounded-lg ${isLowTrust ? 'opacity-60' : ''}`}
                  style={`margin-left: ${entry.depth * 1.25}rem`}
              >
                  <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3">
                          {#if profile?.picture}
                              <img src={profile.picture} alt={profile.name || profile.displayName || 'Avatar'} class="h-10 w-10 rounded-full object-cover" />
                          {:else}
                              <div class="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-mono text-slate-600">
                                  {entry.event.pubkey.slice(0, 2)}
                              </div>
                          {/if}
                          <div class="min-w-0">
                              <p class="text-sm font-semibold text-slate-900 truncate">
                                  {profile?.displayName || profile?.name || entry.event.pubkey.slice(0, 8)}
                              </p>
                              <p class="text-xs text-slate-400 font-mono">
                                  {entry.event.pubkey.slice(0, 6)}...
                              </p>
                          </div>
                      </div>
                      <span class="text-xs text-slate-400">{new Date(entry.event.created_at * 1000).toLocaleString()}</span>
                  </div>

                  <p class="text-sm text-slate-700 mt-3">{entry.event.content}</p>

                  <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {#if score > 0}
                          <Badge status="success" label="Follows" />
                      {/if}
                      {#if score < 0}
                          <Badge status="error" label="Muted" />
                      {/if}
                      {#if $authStore.pubkey}
                          <button
                              class="text-xs text-slate-600 hover:text-slate-900 transition-colors"
                              onclick={() => handleMuteAuthor(entry.event.pubkey)}
                              disabled={mutingAuthor === entry.event.pubkey}
                          >
                              {mutingAuthor === entry.event.pubkey ? 'Muting author…' : 'Mute author'}
                          </button>
                          {#if entry.depth === 0}
                              <button
                                  class="text-xs text-slate-600 hover:text-slate-900 transition-colors"
                                  onclick={() => handleMuteThread(entry.rootId, entry.event.pubkey)}
                                  disabled={mutingThread === entry.rootId}
                              >
                                  {mutingThread === entry.rootId ? 'Muting thread…' : 'Mute thread'}
                              </button>
                          {/if}
                          <button
                              class="text-xs text-slate-600 hover:text-slate-900 transition-colors"
                              onclick={() => handleReport(entry.event)}
                              disabled={reportingId === entry.event.id}
                          >
                              {reportingId === entry.event.id ? 'Reporting…' : 'Report'}
                          </button>
                      {/if}
                  </div>
              </div>
          {/if}
      {/each}
  </div>
</div>
