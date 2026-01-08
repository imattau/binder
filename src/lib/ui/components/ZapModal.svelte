<script lang="ts">
  import { zapPreferenceStore } from '$lib/state/walletPreferenceStore';
  import { zapService } from '$lib/services/zapService';
  import { getActiveRelays } from '$lib/infra/nostr/pool';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import { onMount } from 'svelte';
  import type { ZapDetails } from '$lib/domain/types';

  let { 
    open = $bindable(false), 
    target, 
    name 
  }: { 
    open: boolean, 
    target?: { type: 'profile' | 'event', pubkey: string, eventId?: string, coordinates?: string }, 
    name?: string 
  } = $props();

  let amount = $state(100);
  let message = $state('');
  let step = $state<'amount' | 'confirm-high' | 'loading' | 'invoice' | 'success' | 'error'>('amount');
  let error = $state('');
  let invoice = $state('');
  let zapDetails = $state<ZapDetails | null>(null);
  let copyLabel = $state('Copy');

  const presets = [21, 100, 500, 1000, 5000];

  // Load last amount
  onMount(() => {
    zapPreferenceStore.subscribe(val => {
      if (step === 'amount') amount = val;
    });
  });

  async function startZap() {
    if (!target) return;
    
    if (amount > 10000 && step !== 'confirm-high') {
      step = 'confirm-high';
      return;
    }

    // Save preference
    zapPreferenceStore.setAmount(amount);

    step = 'loading';
    error = '';

    // 1. Resolve Zap Details (LNURL)
    const detailsRes = await zapService.resolveZapDetails(target.pubkey);
    if (!detailsRes.ok) {
      error = detailsRes.error.message;
      step = 'error';
      return;
    }
    zapDetails = detailsRes.value;

    // 2. Build Zap Request (NIP-57)
    const relays = await getActiveRelays();
    
    // Parse coordinates if available
    let kind: number | undefined;
    let d: string | undefined;
    if (target.coordinates) {
      const parts = target.coordinates.split(':');
      if (parts.length >= 3) {
        kind = parseInt(parts[0], 10);
        d = parts.slice(2).join(':');
      }
    }

    const zapRequestRes = await zapService.makeZapRequestEvent(
      target.pubkey,
      amount,
      relays,
      {
        id: target.eventId,
        pubkey: target.pubkey,
        kind,
        d
      },
      message,
      zapDetails.lnurl
    );

    if (!zapRequestRes.ok) {
      error = zapRequestRes.error.message;
      step = 'error';
      return;
    }

    // 3. Fetch Invoice
    if (!zapDetails) {
       error = "Failed to resolve zap details";
       step = 'error';
       return;
    }

    const invoiceRes = await zapService.fetchInvoice(
      zapDetails,
      amount,
      zapRequestRes.value
    );

    if (!invoiceRes.ok) {
      error = invoiceRes.error.message;
      step = 'error';
      return;
    }

    invoice = invoiceRes.value;

    // 4. Try WebLN
    const paidViaWebLn = await zapService.payViaWebLN(invoice);
    if (paidViaWebLn.ok) {
      step = 'success';
      // Ideally trigger a refresh of zaps here
    } else {
      // Fallback to invoice
      step = 'invoice';
    }
  }

  function copyInvoice() {
    navigator.clipboard.writeText(invoice);
    copyLabel = 'Copied!';
    setTimeout(() => copyLabel = 'Copy', 2000);
  }

  function close() {
    open = false;
    step = 'amount';
    error = '';
    message = '';
    invoice = '';
  }

  function reset() {
    step = 'amount';
    error = '';
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
      
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-2 text-slate-900">
          <div class="rounded-full bg-amber-100 p-1.5 text-amber-500">
            <Icon name="Lightning" size={20} weight="fill" />
          </div>
          <span class="font-bold text-lg">Zap {name || 'Author'}</span>
        </div>
        <button class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition" onclick={close}>
          <Icon name="X" size={20} />
        </button>
      </div>

      <!-- Body -->
      {#if step === 'amount'}
        <div class="space-y-6">
          
          <div class="flex flex-col items-center justify-center rounded-xl bg-slate-50 py-6 border border-slate-100">
            <div class="flex items-baseline gap-1">
              <span class="text-4xl font-bold text-slate-900">{amount}</span>
              <span class="text-sm font-semibold text-slate-500">sats</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 justify-center">
            {#each presets as preset}
              <button 
                class="rounded-lg border px-3 py-1.5 text-sm font-semibold transition
                  {amount === preset 
                    ? 'bg-slate-900 text-white border-slate-900' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}"
                onclick={() => amount = preset}
              >
                {preset}
              </button>
            {/each}
          </div>

          <div class="relative">
             <label for="custom-amount" class="sr-only">Custom amount</label>
             <input 
               id="custom-amount"
               type="number" 
               min="1" 
               class="w-full rounded-lg border-slate-200 pl-3 pr-12 text-sm focus:border-slate-900 focus:ring-slate-900"
               placeholder="Custom amount"
               bind:value={amount}
             />
             <span class="absolute right-3 top-2.5 text-xs font-medium text-slate-400">sats</span>
          </div>

          <div>
             <label for="message" class="mb-1 block text-xs font-semibold text-slate-500">Message (optional)</label>
             <textarea 
               id="message"
               class="w-full rounded-lg border-slate-200 text-sm focus:border-slate-900 focus:ring-slate-900" 
               rows="2" 
               bind:value={message}
               maxlength="240"
             ></textarea>
          </div>

          <Button variant="primary" class="w-full justify-center" onclick={startZap}>
             Zap {amount} sats
          </Button>
        </div>

      {:else if step === 'confirm-high'}
        <div class="flex flex-col items-center justify-center py-6 text-center space-y-4">
          <div class="rounded-full bg-amber-100 p-3 text-amber-600">
            <Icon name="CloudWarning" size={32} weight="fill" />
          </div>
          <h3 class="text-lg font-bold text-slate-900">High Amount Warning</h3>
          <p class="text-sm text-slate-500">
            You are about to zap <span class="font-bold text-slate-900">{amount.toLocaleString()} sats</span>.
            <br/>Are you sure you want to proceed?
          </p>
          <div class="flex w-full gap-3 mt-4">
             <Button variant="secondary" class="flex-1 justify-center" onclick={() => step = 'amount'}>Cancel</Button>
             <Button variant="primary" class="flex-1 justify-center" onclick={startZap}>Confirm Zap</Button>
          </div>
        </div>

      {:else if step === 'loading'}
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <Icon name="Pulse" size={32} class="animate-spin text-slate-400 mb-4" />
          <p class="text-sm font-medium text-slate-600">Creating invoice...</p>
        </div>

      {:else if step === 'invoice'}
        <div class="space-y-4">
          <div class="rounded-lg bg-slate-50 p-4 border border-slate-100 break-all text-xs font-mono text-slate-600 max-h-32 overflow-y-auto">
            {invoice}
          </div>
          
          <div class="grid grid-cols-2 gap-3">
             <Button variant="secondary" class="justify-center" onclick={copyInvoice}>
               <Icon name="Copy" size={16} class="mr-2" />
               {copyLabel}
             </Button>
             <a 
               href={`lightning:${invoice}`} 
               class="flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
             >
               Open Wallet
             </a>
          </div>

          <p class="text-center text-xs text-slate-400 mt-2">
            Payment not detected automatically yet. <br/> Check your wallet.
          </p>

          <div class="mt-6">
            <Button variant="secondary" class="w-full justify-center" onclick={close}>Close</Button>
          </div>
        </div>

      {:else if step === 'success'}
        <div class="flex flex-col items-center justify-center py-6 text-center">
          <div class="rounded-full bg-green-100 p-3 text-green-600 mb-4">
            <Icon name="CheckCircle" size={32} weight="fill" />
          </div>
          <h3 class="text-lg font-bold text-slate-900">Zap Sent!</h3>
          <p class="text-sm text-slate-500 mt-1">Thank you for supporting this creator.</p>
          <div class="mt-6">
            <Button variant="secondary" onclick={close}>Close</Button>
          </div>
        </div>

      {:else if step === 'error'}
        <div class="flex flex-col items-center justify-center py-6 text-center">
          <div class="rounded-full bg-rose-100 p-3 text-rose-600 mb-4">
             <Icon name="CloudWarning" size={32} weight="fill" />
          </div>
          <h3 class="text-lg font-bold text-slate-900">Zap Failed</h3>
          <p class="text-sm text-slate-500 mt-2 max-w-[200px]">{error}</p>
          <div class="mt-6">
            <Button variant="secondary" onclick={reset}>Try Again</Button>
          </div>
        </div>
      {/if}

    </div>
  </div>
{/if}
