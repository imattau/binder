<script lang="ts">
  import type { Snippet } from 'svelte';

  let { 
    variant = 'primary', 
    type = 'button',
    disabled = false,
    size = 'md',
    onclick,
    class: className = '',
    children 
  }: {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost',
    type?: 'button' | 'submit' | 'reset',
    disabled?: boolean,
    size?: 'sm' | 'md' | 'lg',
    onclick?: (e: MouseEvent) => void,
    class?: string,
    children: Snippet
  } = $props();

  const variants: Record<string, string> = {
    primary: 'bg-violet-600 text-white shadow-md shadow-violet-200 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-200/50 border border-transparent',
    secondary: 'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300',
    danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:border-red-200',
    ghost: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
</script>

<button
  {type}
  class="
    inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:scale-95
    focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
    disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none
    {variants[variant]} 
    {sizes[size]}
    {className}
  "
  {disabled}
  onclick={onclick}
>
  {@render children()}
</button>