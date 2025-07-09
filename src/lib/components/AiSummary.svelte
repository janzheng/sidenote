<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import { summaryManager } from '../ui/summaryManager.svelte';
  import ToggleDrawer from './ui/ToggleDrawer.svelte';

  interface Props {
    url: string | null;
    content: any;
    summary: string | null;
    isGenerating: boolean;
    onRefresh?: () => void;
  }

  let { url, content, summary, isGenerating, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);
  let isCopied = $state(false);

  // Derived states
  const hasSummary = $derived(summary && summary.length > 0);
  const canGenerate = $derived(url && content && content.text && content.text.length > 0);

  // Handle summary generation
  async function handleGenerateSummary() {
    if (!url || summaryManager.isGenerating) {
      return;
    }

    await summaryManager.handleGenerateSummary(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle copying summary
  async function handleCopySummary() {
    if (!summary) return;
    
    try {
      await navigator.clipboard.writeText(summary);
      isCopied = true;
      setTimeout(() => {
        isCopied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy summary:', error);
    }
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

  // Get button icon based on state
  const getButtonIcon = $derived(() => {
    if (isGenerating || summaryManager.isGenerating) {
      return 'mdi:loading';
    } else if (summaryManager.summaryStatus === 'success') {
      return 'mdi:check';
    } else if (summaryManager.summaryStatus === 'error') {
      return 'mdi:alert';
    } else {
      return 'mdi:brain';
    }
  });

  // Get button text based on state
  const getButtonText = $derived(() => {
    if (isGenerating || summaryManager.isGenerating) {
      return 'Generating...';
    } else if (hasSummary) {
      return 'Regenerate';
    } else {
      return 'Generate Summary';
    }
  });
</script>

<ToggleDrawer
  title="AI Summary"
  bind:isExpanded
>
  {#snippet children()}
    <!-- About Section -->
    <div class="py-2">
      Generate an intelligent summary of the page content using AI. Perfect for quickly understanding long articles, papers, or web pages.
    </div>

    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={handleGenerateSummary}
        class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canGenerate || isGenerating || summaryManager.isGenerating}
        title={summaryManager.summaryError || 'Generate AI Summary'}
      >
        {#if isGenerating || summaryManager.isGenerating}
          <Icon icon="mdi:loading" class="animate-spin w-8 h-8" />
          Summarizing...
        {:else}
          <Icon icon="mdi:brain-freeze" class="w-8 h-8 text-blue-600" />
          <span class="font-semibold px-2 py-1 text-blue-600">Summarize</span>
        {/if}
      </button>
      
      {#if hasSummary && !isGenerating && !summaryManager.isGenerating}
        <button 
          onclick={handleCopySummary}
          class="px-3 py-2 text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
          title="Copy summary"
        >
          {#if isCopied}
            <Icon icon="mdi:check" class="w-6 h-6 text-green-600" />
          {:else}
            <Icon icon="mdi:content-copy" class="w-6 h-6" />
          {/if}
        </button>
      {/if}
    </div>

    <!-- Content Display -->
    {#if summaryManager.summaryError}
      <div class="bg-red-50 border border-red-200 p-3 rounded">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">Summary Error</div>
            <div class="text-sm opacity-75">{summaryManager.summaryError}</div>
          </div>
        </div>
      </div>
    {:else if hasSummary}
      <div class="bg-gray-50 p-3 rounded border min-h-[120px] max-h-[300px] overflow-y-auto">
        <div class="text-gray-700 prose prose-sm max-w-none markdown-content">
          {@html renderMarkdown(summary || '')}
          {#if isGenerating || summaryManager.isGenerating}
            <span class="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1"></span>
          {/if}
        </div>
      </div>
    {:else if !canGenerate}
      <div class="text-gray-500 italic text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:file-document-outline" class="w-8 h-8 opacity-50" />
        <div>No page content available to summarize</div>
        {#if !url}
          <div class="text-xs">Waiting for page URL...</div>
        {:else if !content?.text}
          <div class="text-xs">No extracted content found</div>
        {/if}
      </div>
    {/if}
  {/snippet}
</ToggleDrawer>

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
</style> 