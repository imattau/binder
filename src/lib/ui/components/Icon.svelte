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
  ArrowRight,
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
  Globe
} from 'phosphor-svelte';
import type { IconName } from './iconTypes';

export let name: IconName;
export let size = 20;

let IconComponent: typeof BookOpen | undefined;

const iconMap: Record<IconName, typeof BookOpen> = {
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
  ArrowRight,
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
  Globe
};

  $: IconComponent = iconMap[name];
</script>

{#if IconComponent}
  <IconComponent {size} {...$$restProps} />
{:else}
  <span class="inline-block w-[20px] h-[20px] bg-gray-200 rounded-full" title="Icon not found: {name}"></span>
{/if}
