<script lang="ts">
  import Icon from "@iconify/svelte";
  import CopyButton from "./CopyButton.svelte";
  
  interface Props {
    title: string;
    content: string;
    itemCount?: number | string;
    emptyMessage?: string;
    isLoading?: boolean;
  }
  
  const { 
    title, 
    content, 
    itemCount = "", 
    emptyMessage = "No content available", 
    isLoading = false 
  }: Props = $props();
  
  const displayCount = $derived(typeof itemCount === 'number' ? itemCount : itemCount);
  const hasContent = $derived(content && content.length > 0);
</script>

<details class="bg-gray-50 dark:bg-gray-700 rounded border">
  <summary class="cursor-pointer px-2 py-1 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded flex items-center justify-between min-h-[2rem]">
    <span class="flex items-center gap-2">
      <span class="arrow-icon">
        <Icon icon="mdi:chevron-right" class="w-4 h-4 transition-transform duration-200" />
      </span>
      {title}
      {#if displayCount}({displayCount}{typeof itemCount === 'number' && itemCount === 1 ? 'entry' : typeof itemCount === 'number' ? ' entries' : ''}{typeof itemCount === 'string' ? '' : ''}){/if}
    </span>
    <div class="flex items-center">
      {#if hasContent && !isLoading}
        <CopyButton 
          {content} 
          buttonClass="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors"
          defaultIcon="mdi:content-copy"
          successIcon="mdi:check"
        />
      {/if}
    </div>
  </summary>
  <div class="p-3 border-t bg-white dark:bg-gray-800">
    {#if isLoading}
      <div class="text-gray-500 italic text-sm">Loading...</div>
    {:else if hasContent}
      <pre class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 max-h-96 overflow-y-auto font-mono">{content}</pre>
    {:else}
      <div class="text-gray-500 italic text-sm">{emptyMessage}</div>
    {/if}
  </div>
</details>

<style>
  details[open] .arrow-icon {
    transform: rotate(90deg);
  }
</style> 