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
  const isPDF = $derived(content?.metadata?.contentType === 'pdf' || 
                        content?.metadata?.isPDF === true ||
                        url?.toLowerCase().includes('.pdf') ||
                        url?.toLowerCase().includes('arxiv.org/pdf/'));

  // Get citation metadata for display
  const citationMetadata = $derived.by(() => {
    if (!content?.metadata) return null;
    
    const metadata = content.metadata;
    const citationInfo = metadata.citations || metadata.citationInfo || {};
    
    // ✅ DEBUG: Log citation info for debugging
    console.log('📄 Citations component - citation info:', citationInfo);
    console.log('📄 Citations component - metadata:', metadata);
    console.log('📄 Citations component - has abstract:', !!(citationInfo.abstract || citationInfo.abstract_meta));
    
    return {
      extractionMethod: citationInfo.extractionMethod || metadata.extractionMethod,
      confidence: citationInfo.extractionConfidence || citationInfo.confidence,
      source: citationInfo.citationSource || 'metadata',
      isPDFExtracted: citationInfo.pdfContentExtracted || false,
      hasEnhancedData: !!(citationInfo.authors || citationInfo.doi || citationInfo.arxiv || citationInfo.journal),
      authors: citationInfo.authors,
      journal: citationInfo.journal,
      year: citationInfo.year,
      doi: citationInfo.doi,
      arxiv: citationInfo.arxiv,
      abstract: citationInfo.abstract || citationInfo.abstract_meta
    };
  });

  // Generate BibTeX filename from PDF metadata
  const bibFilename = $derived.by(() => {
    if (!content?.metadata?.filename) {
      return 'citation.bib';
    }
    
    const filename = content.metadata.filename;
    // Remove .pdf extension if present and add .bib
    const baseName = filename.replace(/\.pdf$/i, '');
    return `${baseName}.bib`;
  });

  // Handle citation generation
  async function handleGenerateCitations() {
    if (!url || isGenerating) {
      return;
    }

    try {
      console.log('🔄 Regenerating citations...');
      
      // Use the unified citation generation for both PDF and regular content
      const response = await chrome.runtime.sendMessage({
        action: 'generateCitations',
        url: url
      });
      
      if (response.success) {
        console.log('✅ Citations regenerated successfully');
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.error('❌ Citation generation failed:', response.error);
        // Fall back to full refresh if direct citation generation fails
        if (onRefresh) {
          onRefresh();
        }
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

  // Download citation function
  function downloadCitation(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<ToggleDrawer
  title="Citations"
  bind:isExpanded
>
  {#snippet children()}
    <!-- About Section -->
    <div class="py-2">
      Generate academic citations in multiple formats (APA, Vancouver, Harvard, BibTeX) from page content and metadata. 
      {#if isPDF}
        <strong>PDF content is analyzed using AI for enhanced citation accuracy.</strong>
      {/if}
    </div>

    <!-- Citation Metadata Display -->
    {#if citationMetadata && hasCitations && (citationMetadata.extractionMethod || citationMetadata.confidence || (citationMetadata.authors && citationMetadata.authors.length > 0) || citationMetadata.journal || citationMetadata.year || citationMetadata.doi || citationMetadata.arxiv)}
      <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="text-blue-800 font-medium mb-2">Citation Information</div>
        <div class="space-y-1 text-blue-700">
          {#if citationMetadata.extractionMethod}
            <div>
              <strong>Method:</strong> 
              {#if citationMetadata.extractionMethod === 'ai-pdf-content'}
                AI-enhanced PDF analysis
              {:else if citationMetadata.extractionMethod === 'pdf-content-enhanced'}
                PDF content + metadata
              {:else if citationMetadata.extractionMethod === 'doi'}
                DOI lookup
              {:else if citationMetadata.extractionMethod === 'ai'}
                AI extraction
              {:else}
                {citationMetadata.extractionMethod}
              {/if}
            </div>
          {/if}
          {#if citationMetadata.confidence}
            <div><strong>Confidence:</strong> {citationMetadata.confidence}%</div>
          {/if}
          {#if citationMetadata.authors && citationMetadata.authors.length > 0}
            <div><strong>Authors:</strong> {citationMetadata.authors.join(', ')}</div>
          {/if}
          {#if citationMetadata.journal}
            <div><strong>Journal:</strong> {citationMetadata.journal}</div>
          {/if}
          {#if citationMetadata.year}
            <div><strong>Year:</strong> {citationMetadata.year}</div>
          {/if}
          {#if citationMetadata.doi}
            <div><strong>DOI:</strong> {citationMetadata.doi}</div>
          {/if}
          {#if citationMetadata.arxiv}
            <div><strong>arXiv:</strong> {citationMetadata.arxiv}</div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={handleGenerateCitations}
        class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canGenerate || isGenerating}
        title={isPDF ? "Generate PDF Citations with AI" : "Generate Citations"}
      >
        {#if isGenerating}
          <Icon icon="mdi:loading" class="animate-spin w-8 h-8" />
          {isPDF ? 'Analyzing PDF...' : 'Generating...'}
        {:else}
          <Icon icon="mdi:format-quote-close" class="w-8 h-8 text-blue-600" />
          <span class="font-semibold px-2 py-1 text-blue-600">
            {#if isPDF}
              {hasCitations ? 'Regenerate PDF Citations' : 'Generate PDF Citations'}
            {:else}
              {hasCitations ? 'Regenerate Citations' : 'Generate Citations'}
            {/if}
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
            downloadButton={format.key === 'bibtex' ? {
              text: 'Download .bib',
              filename: bibFilename,
              icon: 'mdi:download',
              onclick: () => downloadCitation(format.content, bibFilename)
            } : undefined}
          />
        {/each}
      </div>
    {:else if !canGenerate}
      <div class="text-gray-500 italic text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:format-quote-close-outline" class="w-8 h-8 opacity-50" />
        <div>No page content available to generate citations</div>
        {#if !url}
          <div class="">Waiting for page URL...</div>
        {:else if !content?.text}
          <div class="">No extracted content found</div>
        {/if}
      </div>
    {/if}
  {/snippet}
</ToggleDrawer>
