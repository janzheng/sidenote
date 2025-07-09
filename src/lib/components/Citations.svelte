<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import ContentDisplay from './ui/ContentDisplay.svelte';
  import type { CitationData } from '../../types/citations';

  interface Props {
    url: string | null;
    content: any;
    citations: CitationData | null;
    isGenerating?: boolean;
    onRefresh?: () => void;
  }

  let { url, content, citations, isGenerating = false, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);

  // Citation format names
  const formatNames = {
    bibtex: 'BibTeX',
    apa: 'APA',
    vancouver: 'Vancouver',
    harvard: 'Harvard',
    chicago: 'Chicago',
    mla: 'MLA'
  };

  // Derived states
  const hasCitations = $derived(citations && Object.keys(citations).length > 0);
  const canGenerate = $derived(url && content && content.text && content.text.length > 0);

  // Handle citation generation
  async function handleGenerateCitations() {
    if (!url || isGenerating) {
      return;
    }

    try {
      console.log('🔄 Regenerating citations...');
      // This would trigger a re-extraction which includes citation generation
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to generate citations:', error);
    }
  }

  // Get available citation formats
  const availableFormats = $derived.by(() => {
    if (!citations) return [];
    
    return Object.entries(formatNames)
      .filter(([key]) => citations[key as keyof CitationData] && citations[key as keyof CitationData]?.trim())
      .map(([key, name]) => ({
        key: key as keyof CitationData,
        name,
        content: citations[key as keyof CitationData] || ''
      }));
  });
</script>

<ToggleDrawer
  title="Citations"
  bind:isExpanded
>
  {#snippet children()}
    <!-- About Section -->
    <div class="py-2">
      Generate academic citations in multiple formats (APA, Vancouver, Harvard, BibTeX) from the page metadata. Perfect for research and academic work.
    </div>

    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={handleGenerateCitations}
        class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canGenerate || isGenerating}
        title="Generate Citations"
      >
        {#if isGenerating}
          <Icon icon="mdi:loading" class="animate-spin w-8 h-8" />
          Generating...
        {:else}
          <Icon icon="mdi:format-quote-close" class="w-8 h-8 text-blue-600" />
          <span class="font-semibold px-2 py-1 text-blue-600">
            {hasCitations ? 'Regenerate' : 'Generate Citations'}
          </span>
        {/if}
      </button>
    </div>

    <!-- Content Display -->
    {#if hasCitations}
      <div class="space-y-4">
        {#each availableFormats as format}
          <ContentDisplay 
            title={format.name}
            content={format.content}
            copyTitle="Copy {format.name} citation"
          />
        {/each}
      </div>
    {:else if !canGenerate}
      <div class="text-gray-500 italic text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:format-quote-close-outline" class="w-8 h-8 opacity-50" />
        <div>No page content available to generate citations</div>
        {#if !url}
          <div class="text-xs">Waiting for page URL...</div>
        {:else if !content?.text}
          <div class="text-xs">No extracted content found</div>
        {/if}
      </div>
    {/if}
  {/snippet}
</ToggleDrawer>
