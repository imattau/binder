<script lang="ts">
  let { left, right } = $props();
</script>

<div class="flex h-full border border-gray-200 rounded-lg overflow-hidden">
  <div class="w-1/2 border-r border-gray-200 overflow-y-auto bg-white h-full">
    {@render left()}
  </div>
  <div class="w-1/2 overflow-y-auto bg-gray-50 h-full">
    {@render right()}
  </div>
</div>
