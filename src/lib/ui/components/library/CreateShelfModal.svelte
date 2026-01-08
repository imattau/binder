<script lang="ts">
  import Button from '$lib/ui/components/Button.svelte';
  import Input from '$lib/ui/components/Input.svelte';
  import Icon from '$lib/ui/components/Icon.svelte';

  let { onClose, onSave } = $props<{ 
      onClose: () => void; 
      onSave: (name: string, isPrivate: boolean) => void;
  }>();

  let name = $state('');
  let isPrivate = $state(false);
  let inputRef = $state<HTMLInputElement | null>(null);

  function handleSave() {
      if (!name.trim()) return;
      onSave(name.trim(), isPrivate);
      onClose();
  }

  $effect(() => {
      inputRef?.focus();
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onclick={onClose}></div>

  <!-- Modal -->
  <div class="relative w-full max-w-md scale-100 transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-xl transition-all">
      <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold leading-6 text-slate-900">Create New Shelf</h3>
          <button onclick={onClose} class="text-slate-400 hover:text-slate-500 transition-colors">
              <Icon name="X" size={24} />
          </button>
      </div>

      <div class="space-y-6">
          <div>
              <label for="shelf-name" class="block text-sm font-medium text-slate-700 mb-2">
                  Shelf Name
              </label>
              <Input 
                  id="shelf-name" 
                  placeholder="e.g. Weekend Reads" 
                  bind:value={name} 
                  bind:ref={inputRef}
                  onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSave()}
              />
          </div>

          <div class="flex items-start gap-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div class="flex h-6 items-center">
                  <input
                      id="shelf-private"
                      type="checkbox"
                      bind:checked={isPrivate}
                      class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600"
                  />
              </div>
              <div class="text-sm leading-6">
                  <label for="shelf-private" class="font-medium text-slate-900">
                      Private (Encrypted)
                  </label>
                  <p class="text-slate-500">
                      Books in this shelf will not be listed in your public bookmarks (NIP-51). They will only be synced to your devices via encrypted storage.
                  </p>
              </div>
          </div>

          <div class="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onclick={onClose}>Cancel</Button>
              <Button variant="primary" onclick={handleSave} disabled={!name.trim()}>Create Shelf</Button>
          </div>
      </div>
  </div>
</div>
