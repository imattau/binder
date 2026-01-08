<script lang="ts">
import Button from './Button.svelte';

export let open = false;
export let minSendable = 0;
export let maxSendable = 0;
export let initialAmount = 0;
export let loading = false;
export let error = '';
export let commentAllowed = 0;
export let defaultMessage = '';
export let onCancel: () => void = () => {};
export let onConfirm: (amount: number, comment?: string) => void = () => {};

const effectiveMinSendable = () => (minSendable > 0 ? minSendable : 1000);
const effectiveMaxSendable = () => {
  if (Number.isFinite(maxSendable) && maxSendable > 0) {
    return maxSendable;
  }
  return Math.max(effectiveMinSendable(), effectiveMinSendable() * 5);
};

const clampAmount = (value: number) => {
  return Math.max(effectiveMinSendable(), Math.min(effectiveMaxSendable(), value));
};

$: minSats = Math.max(1, Math.ceil(effectiveMinSendable() / 1000));
$: maxSats = Math.max(minSats, Math.floor(effectiveMaxSendable() / 1000));
$: defaultSats = Math.max(
  minSats,
  Math.min(maxSats, Math.round((minSats + maxSats) / 2))
);

let sats = defaultSats;
$: if (open) {
  const requested = initialAmount > 0 ? Math.round(initialAmount / 1000) : defaultSats;
  const target = Math.max(minSats, Math.min(maxSats, requested));
  if (sats !== target) {
    sats = target;
  }
}

let message = defaultMessage;
$: if (open && message !== defaultMessage) {
  message = defaultMessage;
}

$: presetButtonSats = [minSats, Math.min(maxSats, minSats * 2), Math.min(maxSats, minSats * 5)]
  .filter((value, index, array) => value > 0 && array.indexOf(value) === index)
  .slice(0, 3);

function handleConfirm() {
  const msats = clampAmount(Math.round(sats * 1000));
  onConfirm(msats, message?.trim() || undefined);
}
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-900">Zap amount</h2>
        <button class="text-slate-400 hover:text-slate-600" onclick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </div>
      <p class="mt-2 text-sm text-slate-500">
        Choose how many sats you want to send (allowed range: {minSats}–{maxSats} sats).
      </p>
      {#if error}
        <div class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 border border-rose-100">
          {error}
        </div>
      {/if}
        <div class="mt-5 space-y-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Amount</span>
            <div class="text-2xl font-semibold text-slate-900">{sats.toLocaleString()} sats</div>
          </div>
          <div>
            <input
              type="range"
              min={minSats}
              max={maxSats}
              step="1"
              bind:value={sats}
              class="w-full accent-violet-500"
            />
            <div class="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{minSats} sats</span>
              <span>{maxSats} sats</span>
            </div>
          </div>
          {#if presetButtonSats.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each presetButtonSats as preset}
                <button
                  type="button"
                  class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-violet-200 hover:text-violet-600 transition"
                  onclick={() => (sats = preset)}
                >
                  {preset.toLocaleString()} sats
                </button>
              {/each}
            </div>
          {/if}
          <div>
            <input
              type="number"
              min={minSats}
              max={maxSats}
              step="1"
              bind:value={sats}
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700"
            />
          </div>
        </div>
        <div class="mt-4 space-y-2">
        <label for="zap-comment" class="block text-sm font-semibold text-slate-700">Add a message (optional)</label>
        <textarea
          id="zap-comment"
          rows="2"
          placeholder={commentAllowed > 0 ? `Max ${commentAllowed} characters` : 'Comments are not supported by this zap'}
          bind:value={message}
          maxlength={commentAllowed || undefined}
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700"
          disabled={!commentAllowed}
        ></textarea>
        {#if commentAllowed}
          <p class="text-xs text-slate-400">{message.length}/{commentAllowed} chars</p>
        {:else}
          <p class="text-xs text-rose-500">This zap endpoint does not accept a comment.</p>
        {/if}
      </div>
      <div class="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onclick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="primary" onclick={handleConfirm} disabled={loading}>
          {#if loading}
            Requesting…
          {:else}
            Zap {sats.toLocaleString()} sats
          {/if}
        </Button>
      </div>
    </div>
  </div>
{/if}
