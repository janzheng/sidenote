<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import CopyButton from "./CopyButton.svelte";
  
  interface Props {
    title: string;
    subtitle?: string;
    content: string;
    itemCount?: number | string;
    emptyMessage?: string;
    isLoading?: boolean;
    isExpanded?: boolean;
    onRefresh?: () => void;
    refreshDisabled?: boolean;
    refreshTitle?: string;
    showRefresh?: boolean;
    showCopy?: boolean;
    renderAsMarkdown?: boolean;
    metadataOnNewRow?: boolean;
  }
  
  let { 
    title, 
    subtitle = '',
    content, 
    itemCount = "", 
    emptyMessage = "No content available", 
    isLoading = false,
    isExpanded = $bindable(false),
    onRefresh,
    refreshDisabled = false,
    refreshTitle = "Refresh",
    showRefresh = false,
    showCopy = true,
    renderAsMarkdown = false,
    metadataOnNewRow = false
  }: Props = $props();
  
  const displayCount = $derived(typeof itemCount === 'number' ? itemCount : itemCount);
  const hasContent = $derived(content && content.length > 0);

  function handleToggle() {
    isExpanded = !isExpanded;
  }

  // Render markdown safely
  function renderMarkdown(content: string): string {
    try {
      const result = marked.parse(content);
      return typeof result === 'string' ? result : content;
    } catch (error) {
      console.warn('Markdown rendering error:', error);
      return content;
    }
  }
</script>

<div class="mb-6">
  <!-- Header with title and buttons -->
  <div class="flex items-center justify-between mb-3">
    <div class="flex-1 min-w-0 {metadataOnNewRow ? 'space-y-1' : ''}">
      <button 
        onclick={handleToggle}
        class="flex items-center gap-2 text-lg font-semibold text-gray-800 hover:text-gray-600 transition-colors"
      >
        <Icon 
          icon="mdi:chevron-right" 
          class="w-5 h-5 transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}" 
        />
        {title}
        {#if displayCount && !metadataOnNewRow}
          <span class="text-sm font-normal text-gray-500">
            ({displayCount}{typeof itemCount === 'number' && itemCount === 1 ? ' entry' : typeof itemCount === 'number' ? ' entries' : ''})
          </span>
        {/if}
        {#if subtitle && !metadataOnNewRow}
          <span class="text-sm font-normal text-gray-500">
            {subtitle}
          </span>
        {/if}
      </button>
      
      {#if metadataOnNewRow && (subtitle || displayCount)}
        <div class="flex items-center gap-2 ml-7">
          {#if displayCount}
            <span class="text-sm text-gray-500">
              ({displayCount}{typeof itemCount === 'number' && itemCount === 1 ? ' entry' : typeof itemCount === 'number' ? ' entries' : ''})
            </span>
          {/if}
          {#if subtitle}
            <span class="text-sm text-gray-500">
              {subtitle}
            </span>
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="flex gap-2">
      {#if showRefresh && onRefresh}
        <button 
          onclick={onRefresh}
          class="px-3 py-1 text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
          disabled={refreshDisabled || isLoading}
          title={refreshTitle}
        >
          {#if isLoading}
            <Icon icon="mdi:loading" class="animate-spin w-6 h-6" />
          {:else}
            <Icon icon="mdi:refresh" class="w-6 h-6" />
          {/if}
        </button>
      {/if}
      
      {#if showCopy && hasContent && !isLoading}
        <CopyButton 
          {content}
          buttonClass="px-3 py-1 text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
          iconClass="w-6 h-6"
          defaultIcon="mdi:content-copy"
          successIcon="mdi:check"
          title="Copy content"
        />
      {/if}
    </div>
  </div>

  <!-- Content area -->
  {#if isExpanded}
    <div class="bg-gray-50 p-3 rounded border min-h-[120px] overflow-y-auto">
      {#if isLoading}
        <div class="flex items-center justify-center h-full">
          <div class="flex items-center gap-2 text-gray-600">
            <Icon icon="mdi:loading" class="animate-spin w-5 h-5" />
            <span>Loading...</span>
          </div>
        </div>
             {:else if hasContent}
         {#if renderAsMarkdown}
           <div class="text-gray-700 prose prose-sm max-w-none markdown-content">
             {@html renderMarkdown(content)}
           </div>
         {:else}
           <pre class="whitespace-pre-wrap text-sm text-gray-700 max-h-96 overflow-y-auto font-mono">{content}</pre>
         {/if}
      {:else}
        <div class="text-gray-500 italic text-sm">{emptyMessage}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .markdown-content :global(ul) {
    list-style-type: disc;
    margin-left: 2rem;
    padding-left: 0.5rem;
    margin-bottom: 1rem;
  }

  .markdown-content :global(ol) {
    list-style-type: decimal;
    margin-left: 2rem;
    padding-left: 0.5rem;
    margin-bottom: 1rem;
  }

  .markdown-content :global(li) {
    margin-bottom: 0.25rem;
    padding-left: 0.5rem;
  }

  .markdown-content :global(ul ul),
  .markdown-content :global(ol ol),
  .markdown-content :global(ul ol),
  .markdown-content :global(ol ul) {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .markdown-content :global(ul ul) {
    list-style-type: circle;
  }

  .markdown-content :global(ul ul ul) {
    list-style-type: square;
  }

  .markdown-content :global(p) {
    margin-bottom: 0.75rem;
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4),
  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    font-weight: 600;
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }

  .markdown-content :global(h1) { font-size: 1.25rem; }
  .markdown-content :global(h2) { font-size: 1.125rem; }
  .markdown-content :global(h3) { font-size: 1rem; }

  .markdown-content :global(code) {
    background-color: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .markdown-content :global(pre) {
    background-color: #f3f4f6;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }
</style>