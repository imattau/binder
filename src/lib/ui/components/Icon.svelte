<script lang="ts">
  import {
    BookOpen,
    Books,
    FileText,
    PencilSimple,
    SealCheck,
    CheckCircle,
    Eye,
    DotsSixVertical,
    ClockCounterClockwise,
    ArrowLeft,
    Gear,
    Pulse,
    CloudCheck,
    CloudWarning,
    Plus,
    Trash,
    X,
    FloppyDisk,
    Heart,
    ArrowsClockwise,
    ChatCircle,
    Lightning,
    DownloadSimple,
    ListBullets,
    SquaresFour,
    CloudArrowDown,
    CloudSlash,
    Export,
    Globe,
    ArrowRight,
    Copy,
    Lock
  } from 'phosphor-svelte';
  import type { IconName } from './iconTypes';

  let { name, size = 20, weight = 'regular', class: className = '' }: { name: IconName, size?: number, weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone', class?: string } = $props();

  const iconMap = {
    BookOpen,
    Books,
    FileText,
    PencilSimple,
    SealCheck,
    CheckCircle,
    Eye,
    DotsSixVertical,
    ClockCounterClockwise,
    ArrowLeft,
    Gear,
    Pulse,
    CloudCheck,
    CloudWarning,
    Plus,
    Trash,
    X,
    FloppyDisk,
    Heart,
    ArrowsClockwise,
    ChatCircle,
    Lightning,
    DownloadSimple,
    CloudArrowDown,
    CloudSlash,
    Export,
    Globe,
    ListBullets,
    SquaresFour,
    ArrowRight,
    Copy,
    Lock
  };
  
  const IconComponent = $derived(iconMap[name as keyof typeof iconMap]);
</script>

{#if IconComponent}
  <IconComponent {size} {weight} class={className} />
{:else}
  <span class="inline-block w-[20px] h-[20px] bg-gray-200 rounded-full" title="Icon not found: {name}"></span>
{/if}