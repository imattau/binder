<script lang="ts">
  let { status = 'neutral', label } = $props();
  
  const colors: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    error: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    neutral: 'bg-slate-50 text-slate-600 ring-slate-500/10'
  };
</script>

<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {colors[status] || colors.neutral}">
  {label}
</span>