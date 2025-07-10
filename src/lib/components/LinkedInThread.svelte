<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import CollapsibleContent from './ui/CollapsibleContent.svelte';
  import { linkedInManager } from '../ui/linkedInManager.svelte';
  import { LinkedInExtractionService } from '../services/linkedInExtractionService';
  import type { PageContent } from '../../types/pageContent';
  import type { SocialMediaThread, LinkedInThread } from '../../types/socialMedia';

  interface Props {
    url: string | null;
    content: PageContent | null;
    linkedInThread?: SocialMediaThread | null;
    isExtracting: boolean;
    isExpanding: boolean;
    onRefresh?: () => void;
  }

  // Helper to cast SocialMediaThread to LinkedInThread when platform is linkedin
  function asLinkedInThread(thread: SocialMediaThread | null): LinkedInThread | null {
    if (!thread || thread.platform !== 'linkedin') return null;
    return thread as LinkedInThread;
  }

  const { 
    url, 
    content, 
    linkedInThread = null,
    isExtracting = false, 
    isExpanding = false, 
    onRefresh 
  }: Props = $props();

  // Component state
  let isExpanded = $state(false);

  // Check if current page is LinkedIn
  const isLinkedInUrl = $derived(
    url?.includes('linkedin.com') || false
  );

  // Derived content for the sections
  const markdownContent = $derived(
    linkedInThread && asLinkedInThread(linkedInThread) 
      ? LinkedInExtractionService.generateMarkdown(asLinkedInThread(linkedInThread)!) 
      : ''
  );

  const jsonContent = $derived(
    linkedInThread ? JSON.stringify(linkedInThread, null, 2) : ''
  );

</script>

<ToggleDrawer 
  title="LinkedIn Thread Extractor" 
  bind:isExpanded
>
  <!-- About Section -->
  <div class="py-2">
    Automatically extracts complete LinkedIn posts and threads with full auto-scrolling and expansion to capture maximum content. Clicks "see more" buttons, loads all comments and replies, and filters content for clean LLM-ready output.
  </div>
  
  <!-- URL Check and Extraction Controls -->
  {#if !isLinkedInUrl}
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div class="flex items-center gap-2 text-gray-600">
        <span class="text-yellow-500">⚠️</span>
        <span class="text-sm">This page is not a LinkedIn URL. Navigate to a LinkedIn post to extract content.</span>
      </div>
    </div>
  {:else}
    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={() => linkedInManager.handleExtractThread(url, onRefresh)}
        class="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={linkedInManager.isExtracting || !isLinkedInUrl}
      >
        {#if linkedInManager.isExtracting}
          <Icon icon="mdi:loading" class="animate-spin w-5 h-5" />
          <span class="font-semibold">{linkedInManager.extractionButtonText}</span>
        {:else}
          <Icon icon="mdi:linkedin" class="w-5 h-5" />
          <span class="font-semibold">{linkedInManager.extractionButtonText}</span>
        {/if}
      </button>
    </div>

    <!-- Large Copy Buttons -->
    {#if linkedInThread}
      <div class="flex gap-2 mb-4">
        <CopyButton 
          content={markdownContent}
          iconClass="w-6 h-6"
          title="Copy thread as markdown"
          buttonClass="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center"
          defaultIcon="mdi:language-markdown"
          successIcon="mdi:check"
        >
          <span class="font-semibold px-2 py-1 text-blue-600">Markdown</span>
        </CopyButton>
        
        <CopyButton 
          content={jsonContent}
          iconClass="w-6 h-6"
          title="Copy thread JSON"
          buttonClass="flex-1 px-3 py-2 bg-transparent border-2 border-gray-300 text-gray-600 rounded hover:border-blue-500 hover:text-blue-600 transition-colors font-semibold flex items-center gap-2 justify-center"
          defaultIcon="mdi:code-json"
          successIcon="mdi:check"
        >
          <span class="font-semibold px-2 py-1">JSON</span>
        </CopyButton>
      </div>
    {/if}

    <!-- Progress Display -->
    {#if linkedInManager.isProcessing}
      <div class="mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
        <div class="flex items-center gap-2">
          <Icon icon="mdi:progress-clock" class="w-6 h-6 text-blue-500" />
          <span class="font-semibold">Extracting LinkedIn thread with auto-scroll and expansion...</span>
        </div>
        {#if linkedInManager.extractionProgress}
          <div class="mt-2 text-xs text-gray-500">
            {linkedInManager.getProgressText()}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Errors -->
    {#if linkedInManager.extractionError}
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <div class="flex items-center gap-2">
          <span class="text-red-500">❌</span>
          <span class="text-sm text-red-700">{linkedInManager.extractionError}</span>
        </div>
      </div>
    {/if}

    <!-- Thread Content Sections -->
    {#if linkedInThread}
      <div class="space-y-4">
        <!-- Markdown Content -->
        <CollapsibleContent
          title="Markdown Content"
          content={markdownContent}
          itemCount="{markdownContent.length} chars"
          emptyMessage="No markdown content available"
          isLoading={false}
        />

        <!-- Raw JSON Data -->
        <CollapsibleContent
          title="Raw Thread Data"
          content={jsonContent}
          itemCount="{jsonContent.length} chars"
          emptyMessage="No thread data available"
          isLoading={false}
        />
      </div>
    {/if}
  {/if}

</ToggleDrawer> 