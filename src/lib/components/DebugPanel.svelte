<script lang="ts">
  import Icon from "@iconify/svelte";
  import ContentStructure from "./ui/ContentStructure.svelte";
  import CollapsibleContent from "./ui/CollapsibleContent.svelte";
  import CopyButton from "./ui/CopyButton.svelte";
  import AiReActAgent from "./AiReActAgent.svelte";
  import type { PanelManager } from "../ui/panelManager.svelte";

  // Props from App.svelte
  interface Props {
    panelManager: PanelManager;
    collapsiblesOnly?: boolean;
  }
  
  let { panelManager, collapsiblesOnly = false }: Props = $props();

  // Reactive state derived from panelManager
  const panelManagerContent = $derived(panelManager.content);
  const content = $derived(panelManagerContent?.content);
  const contentStructure = $derived(panelManagerContent?.analysis?.contentStructure);
  const isLoading = $derived(panelManager.isLoading);
  const error = $derived(panelManager.error);
  const tabId = $derived(panelManager.tabId);
  const url = $derived(panelManager.url);
  const title = $derived(panelManager.title);

  // Create simplified debug data based on current TabData structure
  const debugData = $derived({
    tabId: tabId,
    url: url || '',
    title: title || '',
    contentExists: !!panelManagerContent,
    textLength: panelManagerContent?.content?.text?.length || 0,
    wordCount: panelManagerContent?.content?.wordCount || 0,
    extractedAt: panelManagerContent?.content?.extractedAt || null,
    isLoading: isLoading,
    error: error,
    contentId: panelManagerContent?.meta?.contentId || `${url || 'unknown'}-${tabId || 'unknown'}`,
    lastUpdated: panelManagerContent?.meta?.lastUpdated || null,
    bookmarkStatus: panelManagerContent?.statuses?.bookmarkStatus || 'not-bookmarked'
  });

  // Derived content data for display
  const contentPreview = $derived(panelManagerContent?.content?.text?.substring(0, 500) || '');
  const htmlPreview = $derived(panelManagerContent?.content?.html?.substring(0, 500) || '');
  const metadataDisplay = $derived(panelManagerContent?.content?.metadata ? JSON.stringify(panelManagerContent.content.metadata, null, 2) : '');
  const fullContentDisplay = $derived(panelManagerContent ? JSON.stringify(panelManagerContent, null, 2) : '');

  // Helper functions 
  function formatTimestamp(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getStorageSize(): number {
    return fullContentDisplay.length * 2; // Rough estimate (UTF-16)
  }

</script>

{#snippet collapsibleSections()}
  
  <div class="space-y-2">
    <h3 class="font-medium text-gray-700 dark:text-gray-300 mb-3">
      Debug Panel
    </h3>

    <!-- AI ReAct Agent Component -->
    {#if panelManagerContent}
      <div class="">
        <AiReActAgent 
          url={url}
          content={panelManagerContent.content}
          onRefresh={() => panelManager.refreshDataOnly()}
        />
      </div>
    {/if}
    
    <div>
      <ContentStructure url={url} content={content} {contentStructure} {isLoading} {error} onRefresh={() => panelManager.refreshDataOnly()} />
    </div>

    <CollapsibleContent
      title="Full Content Data"
      content={fullContentDisplay}
      itemCount="{fullContentDisplay.length} chars"
      emptyMessage="No content data available"
      {isLoading}
    />

    <!-- New Citation Metadata Section -->
    {#if panelManager.hasCitations}
      <CollapsibleContent
        title="Citation Metadata"
        content={JSON.stringify(panelManager.citations, null, 2)}
        itemCount="{Object.keys(panelManager.citations || {}).length} fields{panelManager.citationSummary ? ` • ${panelManager.citationSummary.substring(0, 100)}${panelManager.citationSummary.length > 100 ? '...' : ''}` : ''}"
        emptyMessage="No citation metadata available"
        {isLoading}
      />
    {/if}

    <!-- Enhanced Metadata Section -->
    {#if panelManager.hasSchemaData || panelManager.imageCount > 0 || panelManager.internalLinkCount > 0}
      <CollapsibleContent
        title="Enhanced Metadata"
        subtitle={[
          panelManager.imageCount > 0 ? `${panelManager.imageCount} images` : null,
          panelManager.internalLinkCount + panelManager.externalLinkCount > 0 ? `${panelManager.internalLinkCount + panelManager.externalLinkCount} links` : null,
          panelManager.h1Count + panelManager.h2Count + panelManager.h3Count > 0 ? `${panelManager.h1Count + panelManager.h2Count + panelManager.h3Count} headings` : null,
          panelManager.ogTitle ? 'Open Graph' : null,
          panelManager.twitterCard ? 'Twitter' : null
        ].filter(Boolean).join(' • ')}
        content={JSON.stringify({
          schemaData: panelManager.schemaData,
          images: panelManager.images,
          links: panelManager.links,
          headings: panelManager.headings,
          openGraph: {
            title: panelManager.ogTitle,
            description: panelManager.ogDescription,
            image: panelManager.ogImage,
            type: panelManager.ogType
          },
          twitterCard: {
            card: panelManager.twitterCard,
            title: panelManager.twitterTitle,
            description: panelManager.twitterDescription,
            image: panelManager.twitterImage
          }
        }, null, 2)}
        itemCount="{Object.keys({
          schemaData: panelManager.schemaData,
          images: panelManager.images,
          links: panelManager.links,
          headings: panelManager.headings,
          openGraph: {
            title: panelManager.ogTitle,
            description: panelManager.ogDescription,
            image: panelManager.ogImage,
            type: panelManager.ogType
          },
          twitterCard: {
            card: panelManager.twitterCard,
            title: panelManager.twitterTitle,
            description: panelManager.twitterDescription,
            image: panelManager.twitterImage
          }
        }).length} fields"
        emptyMessage="No enhanced metadata available"
        metadataOnNewRow={true}
        {isLoading}
      />
    {/if}

    <CollapsibleContent
      title="Debug Data"
      content={JSON.stringify(debugData, null, 2)}
      itemCount="{Object.keys(debugData).length} fields"
      emptyMessage="No debug data available"
      {isLoading}
    />

    {#if panelManagerContent?.content}
      <CollapsibleContent
        title="Text Content"
        content={panelManagerContent.content.text || ''}
        itemCount="{panelManagerContent.content.text?.length || 0} chars"
        emptyMessage="No text content available"
        {isLoading}
      />

      <CollapsibleContent
        title="HTML Content"
        content={panelManagerContent.content.html || ''}
        itemCount="{panelManagerContent.content.html?.length || 0} chars"
        emptyMessage="No HTML content available"
        {isLoading}
      />

      <CollapsibleContent
        title="Markdown Content"
        content={panelManagerContent.content.markdown || ''}
        itemCount="{panelManagerContent.content.markdown?.length || 0} chars"
        emptyMessage="No Markdown content available"
        {isLoading}
      />
      
      <CollapsibleContent
        title="Metadata"
        content={metadataDisplay}
        itemCount="{Object.keys(panelManagerContent.content.metadata || {}).length} fields"
        emptyMessage="No metadata available"
        {isLoading}
      />
    {/if}
  </div>
{/snippet}

{#if collapsiblesOnly}
  <!-- Collapsibles Only Mode -->
  {@render collapsibleSections()}
{:else}
  <!-- Full Debug Panel Mode -->
  <div class="h-full flex flex-col">

    <div class="flex items-center justify-between mt-4 mb-8">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Debug Panel</h2>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Panel Manager Data and Content Analysis
        </p>
      </div>
    </div>

    <div class="flex-1 flex flex-col space-y-6">
      <!-- Status Display -->
      <div class="space-y-8">
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 class="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Icon icon="mdi:identifier" class="w-4 h-4" />
            Tab Identity
          </h3>
          <div class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Tab ID</div>
                <div class="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                  {debugData.tabId || 'unknown'}
                </div>
              </div>
              <div>
                <div class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Content ID</div>
                <div class="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border break-all">
                  {debugData.contentId}
                </div>
              </div>
            </div>
            <div>
              <div class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Title</div>
              <div class="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                {debugData.title || 'No title'}
              </div>
            </div>
            <div>
              <div class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">URL</div>
              <div class="flex items-center gap-2">
                <div class="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border flex-1 break-all">
                  {debugData.url}
                </div>
                <CopyButton 
                  content={debugData.url} 
                  buttonClass="px-2 py-1 text-xs"
                  defaultIcon="mdi:content-copy"
                  successIcon="mdi:check"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 class="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Icon icon="mdi:file-document" class="w-4 h-4" />
              Content Status
            </h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Exists:</span>
                <span class="font-medium">{debugData.contentExists ? '✅ Yes' : '❌ No'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Text Length:</span>
                <span class="font-mono">{debugData.textLength.toLocaleString()} chars</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Word Count:</span>
                <span class="font-mono">{debugData.wordCount.toLocaleString()} words</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Extracted:</span>
                <span class="font-mono text-xs">{formatTimestamp(debugData.extractedAt)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Storage Size:</span>
                <span class="font-mono">{formatBytes(getStorageSize())}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Bookmark Status:</span>
                <span class="font-medium {debugData.bookmarkStatus === 'success' ? 'text-green-600 dark:text-green-400' : debugData.bookmarkStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}">
                  {debugData.bookmarkStatus === 'success' ? '✅ Bookmarked' : debugData.bookmarkStatus === 'error' ? '❌ Error' : '⏸️ Not Bookmarked'}
                </span>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 class="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Icon icon="mdi:cog" class="w-4 h-4" />
              System State
            </h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between items-center">
                <span class="text-gray-600 dark:text-gray-400">Loading:</span>
                <span class="font-medium flex items-center gap-1">
                  {#if debugData.isLoading}
                    <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
                    Active
                  {:else}
                    ✅ Ready
                  {/if}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Error:</span>
                <span class="font-medium {debugData.error ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}">
                  {debugData.error || 'None'}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Last Updated:</span>
                <span class="font-mono text-xs">{formatTimestamp(debugData.lastUpdated)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>


      <!-- Collapsible Content Sections -->
      {@render collapsibleSections()}
    </div>
  </div>
{/if}


