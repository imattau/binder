<script lang="ts">
  import Button from './Button.svelte';

export let open = false;
export let minSendable = 0;
export let maxSendable = 0;
export let initialAmount = 0;
export let loading = false;
export let error = '';
export let onCancel: () => void = () => {};
export let onConfirm: (amount: number) => void = () => {};

  const clampAmount = (value: number) => {
    return Math.max(minSendable, Math.min(maxSendable, value));
  };

$: minSats = Math.max(1, Math.ceil(minSendable / 1000));
$: maxSats = Math.max(minSats, Math.floor(maxSendable / 1000));
$: defaultSats = Math.max(minSats, Math.min(maxSats, Math.round(initialAmount / 1000)));

let sats = defaultSats;
$: if (open) {
  const target = Math.max(minSats, Math.min(maxSats, Math.round(initialAmount / 1000)));
  if (sats !== target) {
    sats = target;
  }
}

function handleConfirm() {
  const msats = clampAmount(Math.round(sats * 1000));
  onConfirm(msats);
}

function updateSats(value: number) {
  sats = Math.max(minSats, Math.min(maxSats, value));
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
      <div class="mt-5">
        <input
          type="range"
          min={minSats}
          max={maxSats}
          step="1"
          value={sats}
          oninput={(event) => updateSats(Number((event.currentTarget as HTMLInputElement).value))}
          class="w-full"
        />
        <div class="mt-3 flex items-baseline justify-between text-xs text-slate-500">
          <span>{minSats} sats</span>
          <span class="text-slate-900 text-sm font-semibold">{sats.toLocaleString()} sats</span>
          <span>{maxSats} sats</span>
        </div>
        <div class="mt-2">
          <input
            type="number"
            min={minSats}
            max={maxSats}
            step="1"
            value={sats}
            oninput={(event) => updateSats(Number((event.currentTarget as HTMLInputElement).value))}
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700"
          />
        </div>
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
