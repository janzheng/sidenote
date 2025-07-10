<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import CollapsibleContent from './ui/CollapsibleContent.svelte';
  import { twitterManager } from '../ui/twitterManager.svelte';
  import { TwitterExtractionService } from '../services/twitterExtractionService';
  import type { PageContent } from '../../types/pageContent';
  import type { SocialMediaThread, TwitterThread } from '../../types/socialMedia';

  interface Props {
    url: string | null;
    content: PageContent | null;
    twitterThread?: SocialMediaThread | null;
    isExtracting: boolean;
    isExpanding: boolean;
    onRefresh?: () => void;
  }

  // Helper to cast SocialMediaThread to TwitterThread when platform is twitter
  function asTwitterThread(thread: SocialMediaThread | null): TwitterThread | null {
    if (!thread || thread.platform !== 'twitter') return null;
    return thread as TwitterThread;
  }

  const { 
    url, 
    content, 
    twitterThread = null,
    isExtracting = false, 
    isExpanding = false, 
    onRefresh 
  }: Props = $props();

  // Component state
  let isExpanded = $state(false);

  // Check if current page is Twitter/X
  const isTwitterUrl = $derived(
    url?.includes('twitter.com') || 
    url?.includes('x.com') || 
    false
  );

  // Derived content for the sections
  const markdownContent = $derived(
    twitterThread && asTwitterThread(twitterThread) 
      ? TwitterExtractionService.generateMarkdown(asTwitterThread(twitterThread)!) 
      : ''
  );

  const jsonContent = $derived(
    twitterThread ? JSON.stringify(twitterThread, null, 2) : ''
  );


</script>

<ToggleDrawer 
  title="Twitter Thread Extractor" 
  bind:isExpanded
>
  <!-- About Section -->
  <div class="py-2">
    Automatically extracts complete Twitter threads with full auto-scrolling to capture the maximum content. Uses enhanced structural analysis to identify the main conversation, loads all replies and thread content, and filters out recommendations for clean LLM-ready output.
  </div>
  
  <!-- URL Check and Extraction Controls -->
  {#if !isTwitterUrl}
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div class="flex items-center gap-2 text-gray-600">
        <span class="text-yellow-500">⚠️</span>
        <span class="text-sm">This page is not a Twitter/X URL. Navigate to a Twitter thread to extract content.</span>
      </div>
    </div>
  {:else}
    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={() => twitterManager.handleExtractThread(url, onRefresh)}
        class="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={twitterManager.isExtracting || !isTwitterUrl}
      >
        {#if twitterManager.isExtracting}
          <Icon icon="mdi:loading" class="animate-spin w-5 h-5" />
          <span class="font-semibold">{twitterManager.extractionButtonText}</span>
        {:else}
          <Icon icon="mdi:twitter" class="w-5 h-5" />
          <span class="font-semibold">{twitterManager.extractionButtonText}</span>
        {/if}
      </button>
    </div>

    <!-- Large Copy Buttons -->
    {#if twitterThread}
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
    {#if twitterManager.isProcessing}
      <div class="mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
        <div class="flex items-center gap-2">
          <Icon icon="mdi:progress-clock" class="w-6 h-6 text-blue-500" />
          <span class="font-semibold">Extracting Twitter thread with auto-scroll...</span>
        </div>
      </div>
    {/if}

    <!-- Errors -->
    {#if twitterManager.extractionError}
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <div class="flex items-center gap-2">
          <span class="text-red-500">❌</span>
          <span class="text-sm text-red-700">{twitterManager.extractionError}</span>
        </div>
      </div>
    {/if}

    <!-- Thread Content Sections -->
    {#if twitterThread}
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