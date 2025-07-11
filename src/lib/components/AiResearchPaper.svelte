<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import SectionReader from './ui/SectionReader.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import CollapsibleContent from './ui/CollapsibleContent.svelte';
  import { researchPaperManager } from '../ui/researchPaperManager.svelte';
  import { settingsManager } from '../ui/settings.svelte';
  import type { TabData } from '../../types/tabData';

  interface Props {
    tabData: TabData;
    onRefresh?: () => void;
  }

  let { tabData, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);
  let isCopied = $state(false);
  let isLoading = $state(false); // Simple local loading state
  let fakeLoadingProgress = $state('');
  let fakeLoadingStep = $state(0);
  let fakeLoadingInterval: number | null = $state(null);
  let isQuickAnalysis = $state(false); // Track analysis type during loading

  // Derived states from tabData
  const url = $derived(tabData.content.url);
  const content = $derived(tabData.content);
  const researchPaper = $derived(tabData.analysis?.researchPaper);
  const extractionError = $derived(tabData.processing?.researchPaper?.error);
  const extractionProgress = $derived(tabData.processing?.researchPaper?.progress);
  const citations = $derived(tabData.analysis?.citations);

  const hasResearchPaper = $derived(researchPaper && (researchPaper.title || researchPaper.keyFindings || researchPaper.tldr));
  const canExtract = $derived(url && content && content.text && content.text.length > 0);
  const isPDFPage = $derived(
    url?.endsWith('.pdf') || 
    url?.includes('.pdf?') || 
    url?.includes('.pdf#') ||
    url?.includes('arxiv.org/pdf/') ||
    (url?.includes('biorxiv.org') || url?.includes('medrxiv.org')) && url?.includes('.full.pdf')
  );

  // Fake loading progress messages
  const loadingSteps = [
    'Analyzing document structure...',
    'Identifying research sections...',
    'Extracting key findings...',
    'Generating insights...',
    'Processing methodology...',
    'Analyzing results and discussion...',
    'Synthesizing practical implications...',
    'Finalizing analysis...'
  ];

  const quickLoadingSteps = [
    'Scanning document...',
    'Extracting key insights...',
    'Identifying practical implications...',
    'Generating summary...'
  ];

  // Get current loading steps based on analysis type
  const currentLoadingSteps = $derived(
    isQuickAnalysis ? quickLoadingSteps : loadingSteps
  );

  // Start fake loading progress
  function startFakeLoading(quick = false) {
    isQuickAnalysis = quick;
    fakeLoadingStep = 0;
    fakeLoadingProgress = currentLoadingSteps[0];
    
    fakeLoadingInterval = setInterval(() => {
      fakeLoadingStep = (fakeLoadingStep + 1) % currentLoadingSteps.length;
      fakeLoadingProgress = currentLoadingSteps[fakeLoadingStep];
    }, quick ? 2000 : 3000); // Faster progression for quick analysis
  }

  // Stop fake loading progress
  function stopFakeLoading() {
    if (fakeLoadingInterval) {
      clearInterval(fakeLoadingInterval);
      fakeLoadingInterval = null;
    }
    fakeLoadingProgress = '';
    fakeLoadingStep = 0;
    isQuickAnalysis = false;
  }

  // Watch for loading state changes
  $effect(() => {
    if (isLoading && !fakeLoadingInterval) {
      startFakeLoading(isQuickAnalysis);
    } else if (!isLoading && fakeLoadingInterval) {
      stopFakeLoading();
    }
  });

  // Cleanup on component destroy
  $effect(() => {
    return () => {
      if (fakeLoadingInterval) {
        clearInterval(fakeLoadingInterval);
      }
    };
  });

  // Handle research paper extraction (now full analysis)
  async function handleExtractResearchPaper() {
    if (!url || isLoading) {
      return;
    }

    isLoading = true;
    isQuickAnalysis = false;

    try {
      // Start fake loading for comprehensive analysis
      if (!fakeLoadingInterval) {
        startFakeLoading(false);
      }

      await researchPaperManager.handleExtractResearchPaper(url, settingsManager.settings.userBackground, () => {
        if (onRefresh) {
          onRefresh();
        }
      });
    } finally {
      isLoading = false;
    }
  }

  // Handle quick research paper extraction (now main button)
  async function handleQuickExtractResearchPaper() {
    if (!url || isLoading) {
      return;
    }

    isLoading = true;
    isQuickAnalysis = true;

    try {
      // Start fake loading for quick analysis
      if (!fakeLoadingInterval) {
        startFakeLoading(true);
      }

      await researchPaperManager.handleQuickExtractResearchPaper(url, settingsManager.settings.userBackground, () => {
        if (onRefresh) {
          onRefresh();
        }
      });
    } finally {
      isLoading = false;
    }
  }

  // Handle PDF extraction
  async function handleExtractPDF() {
    if (!url) return;
    
    try {
      console.log('📄 Manual PDF extraction triggered...');
      const { PDFExtractionService } = await import('../services/pdfExtractionService.svelte');
      
      const success = await PDFExtractionService.extractAndSaveToTabData(url, document.title || 'PDF Document');
      
      if (success) {
        console.log('✅ Manual PDF extraction completed');
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.log('⚠️ Manual PDF extraction completed but content may be insufficient');
      }
    } catch (error) {
      console.error('❌ Manual PDF extraction failed:', error);
    }
  }

  // Handle copying research paper
  async function handleCopyResearchPaper() {
    if (!researchPaper) return;
    
    try {
      const content = JSON.stringify(researchPaper, null, 2);
      await navigator.clipboard.writeText(content);
      isCopied = true;
      setTimeout(() => {
        isCopied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy research paper:', error);
    }
  }

  // Handle copying citations
  async function copyCitation(type: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} citation copied to clipboard`);
    } catch (error) {
      console.error(`Failed to copy ${type} citation:`, error);
    }
  }
</script>

<ToggleDrawer 
  title="Research Paper Analysis" 
  subtitle=""
  bind:isExpanded
>

  <!-- About Section -->
  <div class="py-2">
    Extract and analyze academic papers like nature, arxiv, etc. Uses AI to provide comprehensive analysis with sections.
  </div>

  <!-- Background Input -->
  <div class="mb-4">
    <label for="userBackground" class="block text-sm font-medium text-gray-700 mb-1">
      Your Background (Optional)
    </label>
    <textarea
      id="userBackground"
      bind:value={settingsManager.settings.userBackground}
      placeholder="e.g., computer science, biology, economics..."
      rows="3"
      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-vertical"
      disabled={isLoading}
      oninput={() => settingsManager.updateSetting('userBackground', settingsManager.settings.userBackground)}
    ></textarea>
    <p class="text-xs text-gray-500 mt-1">
      Help the AI tailor explanations to your field of expertise
    </p>
  </div>

  <!-- Control Buttons -->
  <div class="flex gap-2 mb-4">
    <button 
      onclick={handleQuickExtractResearchPaper}
      class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isLoading || !canExtract}
    >
      {#if isLoading && isQuickAnalysis}
        <Icon icon="mdi:loading" class="animate-spin w-8 h-8" />
        Quick Analysis...
      {:else}
        <Icon icon="mdi:brain-freeze" class="w-8 h-8 text-blue-600" />
        <span class="font-semibold px-2 py-1 text-blue-600">{hasResearchPaper ? 'Re-analyze Research Paper' : 'Analyze Research Paper'}</span>
      {/if}
    </button>
    
    <!-- Full Analysis Button -->
    <button 
      onclick={handleExtractResearchPaper}
      class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isLoading || !canExtract}
      title="Full Analysis - Extract all sections with complete content"
    >
      {#if isLoading && !isQuickAnalysis}
        <Icon icon="mdi:loading" class="animate-spin w-5 h-5" />
      {:else}
        <Icon icon="mdi:magic-staff" class="w-5 h-5" />
      {/if}
    </button>
    
    <!-- PDF Extract Button - shown when on PDF page but no content -->
    {#if isPDFPage && (!content?.text || content.text.includes('[PDF Document Detected:') || content.text.trim().length < 50)}
      <button 
        onclick={handleExtractPDF}
        class="px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100 transition-colors flex items-center gap-1 text-sm"
        title="Extract PDF content to enable analysis"
      >
        <Icon icon="mdi:file-pdf-box" class="w-4 h-4" />
        Extract PDF
      </button>
    {/if}
  </div>

  <!-- Content Display -->
  {#if extractionError || researchPaper}
    <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded border min-h-[120px] overflow-y-auto">
      {#if extractionError}
        <div class="text-red-600 dark:text-red-400 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-6 h-6" />
          <div>
            <div class="font-medium">Analysis Error</div>
            <div class="opacity-75">{extractionError}</div>
          </div>
        </div>
      {:else if researchPaper}
        <div class="research-paper-content">
          <!-- Section Reader Component -->
          <SectionReader analysisData={researchPaper} url={url} onRefresh={onRefresh} />

          <!-- Citations Display -->
          {#if citations && (citations.bibtex || citations.apa)}
            <div class="citations-frame mt-8 space-y-4">
              <!-- BibTeX Citation -->
              {#if citations.bibtex}
                <CollapsibleContent 
                  title="BibTeX Citation" 
                  content={citations.bibtex}
                  emptyMessage="No BibTeX citation available"
                />
              {/if}

              <!-- APA Citation -->
              {#if citations.apa}
                <CollapsibleContent 
                  title="APA Citation" 
                  content={citations.apa}
                  emptyMessage="No APA citation available"
                />
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else if !content?.text}
    <div class="text-gray-500 italic text-center py-8 flex flex-col items-center gap-2">
      <Icon icon="solar:document-text-linear" class="w-8 h-8 opacity-50" />
      <div>No page content available to analyze</div>
    </div>
  {/if}
</ToggleDrawer>

<style>
  /* Research Paper Content Styling */
  .research-paper-content {
    font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }

  /* Override markdown headers to be smaller and less prominent for monospace fonts */
  .research-paper-content :global(h1),
  .research-paper-content :global(h2),
  .research-paper-content :global(h3),
  .research-paper-content :global(h4),
  .research-paper-content :global(h5),
  .research-paper-content :global(h6) {
    font-size: 14px !important;
    font-weight: 600 !important;
    color: #374151 !important;
    margin: 8px 0 4px 0 !important;
    line-height: 1.3 !important;
    font-family: inherit !important;
    text-transform: none !important;
    letter-spacing: normal !important;
  }

  /* Make h1 and h2 slightly larger but still compact */
  .research-paper-content :global(h1) {
    font-size: 15px !important;
    font-weight: 700 !important;
    color: #1f2937 !important;
  }

  .research-paper-content :global(h2) {
    font-size: 14px !important;
    font-weight: 650 !important;
    color: #1f2937 !important;
  }

  /* Ensure paragraphs have proper spacing for monospace */
  .research-paper-content :global(p) {
    font-size: 13px !important;
    line-height: 1.5 !important;
    margin: 0 0 8px 0 !important;
    font-family: inherit !important;
  }

  /* Style lists for monospace readability */
  .research-paper-content :global(ul),
  .research-paper-content :global(ol) {
    margin: 0 0 8px 0 !important;
    padding-left: 16px !important;
  }

  .research-paper-content :global(li) {
    font-size: 13px !important;
    line-height: 1.4 !important;
    margin-bottom: 2px !important;
    font-family: inherit !important;
  }

  /* Style code blocks and inline code for monospace */
  .research-paper-content :global(code) {
    background: #f1f5f9 !important;
    padding: 1px 3px !important;
    border-radius: 2px !important;
    font-size: 12px !important;
    font-family: inherit !important;
  }

  .research-paper-content :global(pre) {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 4px !important;
    padding: 8px !important;
    overflow-x: auto !important;
    font-size: 12px !important;
    line-height: 1.4 !important;
    margin: 8px 0 !important;
  }

  /* Style blockquotes for monospace */
  .research-paper-content :global(blockquote) {
    border-left: 3px solid #cbd5e1 !important;
    padding-left: 12px !important;
    margin: 8px 0 !important;
    color: #64748b !important;
    font-style: italic !important;
  }

  /* Links styling */
  .research-paper-content :global(a) {
    color: #3b82f6 !important;
    text-decoration: none !important;
  }

  .research-paper-content :global(a:hover) {
    text-decoration: underline !important;
  }

  /* Strong and emphasis */
  .research-paper-content :global(strong) {
    font-weight: 700 !important;
    color: #1f2937 !important;
  }

  .research-paper-content :global(em) {
    font-style: italic !important;
  }

  /* Tables styling for monospace */
  .research-paper-content :global(table) {
    width: 100% !important;
    border-collapse: collapse !important;
    margin: 8px 0 !important;
    font-size: 12px !important;
  }

  .research-paper-content :global(th),
  .research-paper-content :global(td) {
    border: 1px solid #e2e8f0 !important;
    padding: 4px 6px !important;
    text-align: left !important;
  }

  .research-paper-content :global(th) {
    background: #f8fafc !important;
    font-weight: 600 !important;
  }
</style> 