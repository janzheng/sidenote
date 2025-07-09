<script lang="ts">
  import Icon from "@iconify/svelte";
  import ContentStructure from "./ui/ContentStructure.svelte";
  import ContentReader from "./ContentReader.svelte";
  import CollapsibleContent from "./ui/CollapsibleContent.svelte";
  import CopyButton from "./ui/CopyButton.svelte";
  import type { PanelManager } from "../ui/panelManager.svelte";

  // Props from App.svelte
  interface Props {
    panelManager: PanelManager;
    collapsiblesOnly?: boolean;
  }
  
  let { panelManager, collapsiblesOnly = false }: Props = $props();

  // Reactive state derived from panelManager
  const content = $derived(panelManager.content);
  const isLoading = $derived(panelManager.isLoading);
  const error = $derived(panelManager.error);
  const tabId = $derived(panelManager.tabId);
  const url = $derived(panelManager.url);
  const title = $derived(panelManager.title);

  console.log('panel manager data', panelManager);

  // Create simplified debug data based on current TabData structure
  const debugData = $derived({
    tabId: tabId,
    url: url || '',
    title: title || '',
    contentExists: !!content,
    textLength: content?.content?.text?.length || 0,
    wordCount: content?.content?.wordCount || 0,
    extractedAt: content?.content?.extractedAt || null,
    isLoading: isLoading,
    error: error,
    contentId: content?.meta?.contentId || `${url || 'unknown'}-${tabId || 'unknown'}`,
    lastUpdated: content?.meta?.lastUpdated || null,
    bookmarkStatus: content?.statuses?.bookmarkStatus || 'not-bookmarked'
  });

  // Derived content data for display
  const contentPreview = $derived(content?.content?.text?.substring(0, 500) || '');
  const htmlPreview = $derived(content?.content?.html?.substring(0, 500) || '');
  const metadataDisplay = $derived(content?.content?.metadata ? JSON.stringify(content.content.metadata, null, 2) : '');
  const fullContentDisplay = $derived(content ? JSON.stringify(content, null, 2) : '');

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

  // Actions
  function handleRefresh() {
    panelManager.refresh();
  }

  function handleCopyUrl() {
    if (url) {
      navigator.clipboard.writeText(url);
    }
  }

  function handleCopyContent() {
    if (content?.content?.text) {
      navigator.clipboard.writeText(content.content.text);
    }
  }

  function handleCopyMarkdown() {
    if (content?.content?.markdown) {
      navigator.clipboard.writeText(content.content.markdown);
    }
  }
</script>

{#snippet collapsibleSections()}
  
  <div class="space-y-2">
    <div>
      <ContentReader {content} {isLoading} {error} />
    </div>

    <div>
      <ContentStructure {content} {isLoading} {error} />
    </div>

    <CollapsibleContent
      title="Debug Data"
      content={JSON.stringify(debugData, null, 2)}
      itemCount="{Object.keys(debugData).length} fields"
      emptyMessage="No debug data available"
      {isLoading}
    />

    <CollapsibleContent
      title="Full Content Data"
      content={fullContentDisplay}
      itemCount="{fullContentDisplay.length} chars"
      emptyMessage="No content data available"
      {isLoading}
    />

    {#if content?.content}
      <CollapsibleContent
        title="Text Content"
        content={content.content.text || ''}
        itemCount="{content.content.text?.length || 0} chars"
        emptyMessage="No text content available"
        {isLoading}
      />

      <CollapsibleContent
        title="HTML Content"
        content={content.content.html || ''}
        itemCount="{content.content.html?.length || 0} chars"
        emptyMessage="No HTML content available"
        {isLoading}
      />

      <CollapsibleContent
        title="Markdown Content"
        content={content.content.markdown || ''}
        itemCount="{content.content.markdown?.length || 0} chars"
        emptyMessage="No Markdown content available"
        {isLoading}
      />
      
      <CollapsibleContent
        title="Metadata"
        content={metadataDisplay}
        itemCount="{Object.keys(content.content.metadata || {}).length} fields"
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
                <CopyButton content={debugData.url} buttonClass="px-2 py-1 text-xs" />
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


