<script lang="ts">
  import '@fontsource-variable/eb-garamond';
  import { onDestroy } from "svelte";
  import { panelManager } from './lib/ui/panelManager.svelte';
  import { bookmarkManager } from './lib/ui/bookmarkManager.svelte';
  import Settings from './lib/components/Settings.svelte';
  import ManualContentInput from './lib/components/ManualContentInput.svelte';
  import DebugPanel from './lib/components/DebugPanel.svelte';
  import AiSummary from './lib/components/AiSummary.svelte';
  import AiRecipe from './lib/components/AiRecipe.svelte';
  import Threadgirl from './lib/components/Threadgirl.svelte';
  import Citations from './lib/components/Citations.svelte';
  import AiChat from './lib/components/AiChat.svelte';
  import TwitterThread from './lib/components/TwitterThread.svelte';
  import LinkedInThread from './lib/components/LinkedInThread.svelte';
  import PageAssets from './lib/components/PageAssets.svelte';
  import PageScreenshots from './lib/components/PageScreenshots.svelte';
  import PDFDownloadButton from './lib/components/ui/PDFDownloadButton.svelte';
  
  import Icon from "@iconify/svelte";
  
  type TabType = 'content' | 'settings' | 'manual-input' | 'debug';
  let currentTab = $state<TabType>('content');
  
  const toggleManualInput = () => {
    currentTab = currentTab === 'manual-input' ? 'content' : 'manual-input';
  };
  
  const toggleSettings = () => {
    currentTab = currentTab === 'settings' ? 'content' : 'settings';
  };
  
  const toggleDebug = () => {
    currentTab = currentTab === 'debug' ? 'content' : 'debug';
  };
  
  onDestroy(() => {
    panelManager.cleanup();
  });
</script>

<div class="flex flex-col bg-paper min-h-screen">
  <!-- Header -->
  <header class="px-2 py-2 flex-shrink-0">
    <div class="flex items-center justify-between w-full">
      <!-- Left side buttons -->
      <div class="flex items-center gap-2">
        <button 
          onclick={() => panelManager.refresh()}
          class="px-6 py-1 rounded text-md flex items-center gap-1 transition-colors duration-200 border
                 {panelManager.isLoading ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' :
                  'bg-gray-800 border-gray-800 text-white hover:bg-gray-900'}"
          disabled={panelManager.isLoading}
        >
          {#if panelManager.isLoading}
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          {:else}
            <Icon icon="mdi:refresh" />
          {/if}
        </button>
        
        <!-- Quick bookmark button -->
        <button 
          onclick={() => bookmarkManager.handleQuickBookmark(panelManager.url, () => panelManager.refreshDataOnly())}
          class="{panelManager.isBookmarked ? 
            'px-6 py-1 rounded text-md text-white bg-green-600 border border-green-600 hover:bg-green-700 flex items-center gap-1' :
            bookmarkManager.getQuickBookmarkClass()}"
          disabled={panelManager.isLoading || bookmarkManager.isQuickBookmarking || !panelManager.content}
          title={panelManager.isBookmarked ? "Already bookmarked" : (bookmarkManager.quickBookmarkError || "Quick Bookmark to External API")}
        >
          {#if bookmarkManager.isQuickBookmarking}
            <Icon icon="mdi:loading" class="animate-spin" />
          {:else if panelManager.isBookmarked}
            <Icon icon="mdi:check" />
          {:else if bookmarkManager.quickBookmarkStatus === 'success'}
            <Icon icon="mdi:check" />
          {:else if bookmarkManager.quickBookmarkStatus === 'error'}
            <Icon icon="mdi:alert" />
          {:else}
            <Icon icon="mdi:bookmark" />
          {/if}
        </button>

      </div>
      
      <!-- Right side buttons -->
      <div class="flex items-center gap-2">
        <button 
          onclick={toggleManualInput}
          class="px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1"
          class:bg-blue-600={currentTab === 'manual-input'}
          class:hover:bg-blue-700={currentTab === 'manual-input'}
          title="Manual Content Input"
        >
          <Icon icon="mdi:briefcase" />
          {#if currentTab === 'manual-input'}
            <span class="text-sm leading-none">Back</span>
          {/if}
        </button>
        
        <button 
          onclick={toggleDebug}
          class="px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1"
          class:bg-blue-600={currentTab === 'debug'}
          class:hover:bg-blue-700={currentTab === 'debug'}
          title="Debug Panel"
        >
          <Icon icon="mdi:bug" />
          {#if currentTab === 'debug'}
            <span class="text-sm leading-none">Back</span>
          {/if}
        </button>
        
        <button 
          onclick={toggleSettings}
          class="px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1"
          class:bg-blue-600={currentTab === 'settings'}
          class:hover:bg-blue-700={currentTab === 'settings'}
          title="Settings"
        >
          <Icon icon="mdi:settings" />
          {#if currentTab === 'settings'}
            <span class="text-sm leading-none">Back</span>
          {/if}
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 px-2 overflow-auto flex flex-col gap-2 min-h-0 flex-grow">
    {#if currentTab === 'settings'}
      <Settings />
    {:else if currentTab === 'manual-input'}
      <ManualContentInput />
    {:else if currentTab === 'debug'}
      <DebugPanel {panelManager} />
    {:else if panelManager.error}
      <div class="p-4 text-center">
        <div class="text-red-600 mb-2">❌ Error</div>
        <p class="text-sm text-gray-600 mb-4">{panelManager.error}</p>
        <button 
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onclick={() => panelManager.refresh()}
        >
          Retry
        </button>
      </div>
    {:else if panelManager.content}
      <div class="">
        <div class="mb-4">
          <h2 class="text-xl font-bold pt-4 mb-2">{panelManager.title}</h2>
          {#if panelManager.contentMetadata.description}
            <p class="text-gray-700 mb-3">{panelManager.contentMetadata.description}</p>
          {/if}
          <div class="text-gray-600 space-y-1">
          <p><strong>URL:</strong> {panelManager.url}</p>
            <p><strong>Tab ID:</strong> {panelManager.tabId}</p>
            <p><strong>Word count:</strong> {panelManager.wordCount}</p>
          </div>
          
          <!-- PDF Download Button -->
          {#if panelManager.url && (panelManager.url.toLowerCase().includes('.pdf') || 
                                   panelManager.url.toLowerCase().includes('arxiv.org/pdf/') ||
                                   (panelManager.url.toLowerCase().includes('biorxiv.org') && panelManager.url.toLowerCase().includes('.full.pdf')) ||
                                   (panelManager.url.toLowerCase().includes('medrxiv.org') && panelManager.url.toLowerCase().includes('.full.pdf')))}
                         <div class="mt-3 pt-3 border-t border-gray-200">
               <PDFDownloadButton 
                 url={panelManager.url}
                 title={panelManager.title || 'PDF Document'}
                 filename={panelManager.content?.content?.metadata?.filename}
                 tabData={panelManager.content}
                 variant="primary"
                 size="md"
                 showFilename={true}
               />
             </div>
          {/if}
        </div>
        
      </div>
    {:else}
      <div class="p-4 text-center text-gray-500">
        <p>No content available</p>
        <button 
          class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onclick={() => panelManager.refresh()}
        >
          Load Content
        </button>
      </div>
    {/if}

    <!-- Components -->
    <div class="space-y-2">
      <!-- AI Summary Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <AiSummary 
            url={panelManager.url}
            content={panelManager.content.content}
            summary={panelManager.content.analysis?.summary}
            isGenerating={panelManager.content.processing?.summary?.isStreaming || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}

      <!-- AI Chat Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <AiChat 
            url={panelManager.url}
            content={panelManager.content.content}
            chatMessages={panelManager.content.analysis?.chatMessages}
            isGenerating={panelManager.content.processing?.chat?.isGenerating || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}

      <!-- Citations Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <Citations 
            url={panelManager.url}
            content={panelManager.content.content}
            citations={panelManager.content.analysis?.citations}
            isGenerating={panelManager.content.processing?.citations?.isGenerating || false}
            onRefresh={() => panelManager.refresh()}
          />
        </div>
      {/if}

      <!-- Threadgirl Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <Threadgirl 
            url={panelManager.url}
            content={panelManager.content.content}
            threadgirlResults={panelManager.content.analysis?.threadgirlResults}
            isProcessing={panelManager.content.processing?.threadgirl?.isProcessing || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}

      <!-- Twitter Thread Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <TwitterThread 
            url={panelManager.url}
            content={panelManager.content.content}
            twitterThread={panelManager.content.analysis?.socialMediaThread}
            isExtracting={panelManager.content.processing?.socialMediaThread?.isExtracting || false}
            isExpanding={panelManager.content.processing?.socialMediaThread?.isExpanding || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}

      <!-- LinkedIn Thread Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <LinkedInThread 
            url={panelManager.url}
            content={panelManager.content.content}
            linkedInThread={panelManager.content.analysis?.socialMediaThread}
            isExtracting={panelManager.content.processing?.socialMediaThread?.isExtracting || false}
            isExpanding={panelManager.content.processing?.socialMediaThread?.isExpanding || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}

      <!-- AI Recipe Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <AiRecipe 
            url={panelManager.url}
            content={panelManager.content.content}
            recipe={panelManager.content.analysis?.recipe}
            isExtracting={panelManager.content.processing?.recipe?.isExtracting || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}

      <!-- Page Assets Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <PageAssets 
            url={panelManager.url}
            content={panelManager.content.content}
            pageAssets={panelManager.content.analysis?.pageAssets}
            isExtracting={panelManager.content.processing?.pageAssets?.isExtracting || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}

      <!-- Page Screenshots Component -->
      {#if currentTab === 'content' && panelManager.content}
        <div class="">
          <PageScreenshots 
            url={panelManager.url}
            content={panelManager.content.content}
            screenshots={panelManager.content.analysis?.pageAssets?.screenshots}
            isExtracting={panelManager.content.processing?.pageAssets?.isExtracting || false}
            onRefresh={() => panelManager.refreshDataOnly()}
          />
        </div>
      {/if}
    </div>

    <!-- Debug Panel at bottom with collapsibles only mode -->
    {#if currentTab !== 'debug'}
      <div class="mt-8 pt-4">
        <DebugPanel {panelManager} collapsiblesOnly={true} />
      </div>
    {/if}
  </main>
</div>
