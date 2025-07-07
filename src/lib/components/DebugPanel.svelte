<script lang="ts">
  import ContentStructure from "./ContentStructure.svelte";
  import ContentReader from "./ContentReader.svelte";
  import CollapsibleContent from "./CollapsibleContent.svelte";
  import { tabDataController } from "../services/tabDataController.js";
  import type { DebugPanelData, TabData } from "../types/tabData.js";
  
  // State for Redux debug data
  let reduxDebugData = $state<DebugPanelData | null>(null);
  let currentUrl = $state('');
  let currentTabId = $state<number | null>(null);
  let isLoading = $state(false);

  // Subscribe to TabDataController state changes
  let unsubscribe: (() => void) | null = null;

  // Initialize and subscribe to Redux state
  async function initializeReduxDebug() {
    try {
      isLoading = true;
      
      // Get current tab info
      const tabInfo = await getCurrentTabInfo();
      if (tabInfo.success) {
        currentTabId = tabInfo.tabId || null;
        currentUrl = tabInfo.url || '';
        
        // Update debug data
        updateDebugData();
        
        // Subscribe to state changes
        if (unsubscribe) unsubscribe();
        unsubscribe = tabDataController.subscribe(() => {
          updateDebugData();
        });
      }
    } catch (error) {
      console.error('Failed to initialize Redux debug:', error);
    } finally {
      isLoading = false;
    }
  }

  // Update debug data from current state
  function updateDebugData() {
    if (currentUrl) {
      reduxDebugData = tabDataController.getDebugData(currentUrl, currentTabId);
    }
  }

  // Get current tab information
  async function getCurrentTabInfo(): Promise<{ 
    success: boolean; 
    tabId?: number; 
    url?: string; 
    title?: string; 
    error?: string 
  }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
        } else if (response && response.success) {
          resolve({
            success: true,
            tabId: response.tabId,
            url: response.url,
            title: response.title
          });
        } else {
          resolve({ 
            success: false, 
            error: response?.error || 'Failed to get current tab' 
          });
        }
      });
    });
  }

  // Initialize on mount
  initializeReduxDebug();

  // Cleanup on unmount
  function cleanup() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  // Derived values for display
  const tabDataState = $derived(tabDataController.getState());
  const currentContent = $derived(
    (reduxDebugData && reduxDebugData.contentExists && reduxDebugData.currentContentId)
      ? tabDataController.getContent(reduxDebugData.currentContentId) 
      : null
  );

  // Get all tracked tabs with their metadata
  const allTrackedTabs = $derived((() => {
    const state = tabDataController.getState();
    console.log('🔧 DEBUG: allTrackedTabs - Raw state:', state);
    console.log('🔧 DEBUG: allTrackedTabs - State keys:', Object.keys(state));
    console.log('🔧 DEBUG: allTrackedTabs - State entries count:', Object.entries(state).length);
    
    const tabsData: Array<{
      contentId: string;
      content: TabData;
      activeTabIds: number[];
      title: string;
      description: string;
      url: string;
      domain: string;
      wordCount: number;
      extractedAt: number | null;
      isCurrentTab: boolean;
    }> = [];

    Object.entries(state).forEach(([contentId, tabData]) => {
      console.log('🔧 DEBUG: Processing tab data:', { contentId, tabData });
      // Get a preview of the text content for description
      const text = tabData.content.text || '';
      const description = text.length > 200 ? text.substring(0, 200) + '...' : text;
      
      // Extract domain from URL
      let domain = 'Unknown';
      try {
        if (tabData.content.url) {
          domain = new URL(tabData.content.url).hostname;
        }
      } catch (e) {
        domain = tabData.content.url || 'Unknown';
      }

      // Check if this is the current tab
      const isCurrentTab = contentId === reduxDebugData?.currentContentId;

      tabsData.push({
        contentId,
        content: tabData,
        activeTabIds: Array.from(tabData.meta.activeTabIds),
        title: tabData.content.title || 'Untitled',
        description: description || 'No content extracted',
        url: tabData.content.url || '',
        domain,
        wordCount: tabData.content.wordCount || 0,
        extractedAt: tabData.content.extractedAt || null,
        isCurrentTab
      });
    });

    // Sort by last updated, with current tab first
    return tabsData.sort((a, b) => {
      if (a.isCurrentTab) return -1;
      if (b.isCurrentTab) return 1;
      return (b.content.meta.lastUpdated || 0) - (a.content.meta.lastUpdated || 0);
    });
  })());
  
  // Format data for display
  const reduxStateContent = $derived(JSON.stringify(tabDataState, (key, value) => {
    // Convert Sets to Arrays for JSON serialization
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }, 2));
  
  const debugDataContent = $derived(reduxDebugData ? JSON.stringify(reduxDebugData, null, 2) : '');
  const currentContentDisplay = $derived(currentContent ? JSON.stringify(currentContent, (key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }, 2) : '');

  // Legacy support - keep some old data for comparison during migration
  import { 
    debugLog, 
    addToLog
  } from "../stores/apiStore";
  
  const debugLogContent = $derived($debugLog.join('\n'));
</script>

<style>
  .redux-status {
    padding: 8px;
    border-radius: 4px;
    margin-bottom: 8px;
    font-family: monospace;
    font-size: 12px;
  }
  
  .redux-status.healthy {
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
  }
  
  .redux-status.loading {
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    color: #856404;
  }
  
  .redux-status.error {
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
  }

  .tab-card {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
    background: white;
    font-size: 12px;
  }

  .tab-card.current {
    border-color: #007bff;
    background: #f8f9ff;
  }

  .tab-title {
    font-weight: bold;
    color: #333;
    margin-bottom: 4px;
    font-size: 13px;
  }

  .tab-description {
    color: #666;
    line-height: 1.3;
    margin-bottom: 6px;
  }

  .tab-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 11px;
    color: #888;
  }

  .tab-meta span {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .tab-meta .current-indicator {
    background: #007bff;
    color: white;
  }

  .auto-tracking-note {
    background: #e7f3ff;
    border: 1px solid #b3d9ff;
    color: #0066cc;
    padding: 8px;
    border-radius: 4px;
    font-size: 11px;
    margin-bottom: 8px;
    text-align: center;
  }
</style>

<div class="pt-4 pb-4 px-2 bg-gray-100">
  <div class="flex flex-col gap-2 mb-2">
    <span class="text-sm tracking-widest uppercase font-semibold">Redux Tab Data Model Debug</span>
  </div>

  <!-- Redux Status Display -->
  {#if reduxDebugData}
    <div class="redux-status healthy">
      <div><strong>🆔 CURRENT TAB IDENTITY</strong></div>
      <div>Tab ID: {reduxDebugData.currentTabId || 'unknown'} | Content ID: {reduxDebugData.currentContentId}</div>
      <div>URL: {reduxDebugData.currentUrl}</div>
      
      <div style="margin-top: 8px;"><strong>📄 CURRENT CONTENT STATE</strong></div>
      <div>Exists: {reduxDebugData.contentExists ? '✅' : '❌'} | Text: {reduxDebugData.textLength} chars | Words: {reduxDebugData.wordCount}</div>
      <div>HTML: {reduxDebugData.htmlLength} chars | Markdown: {reduxDebugData.markdownLength} chars</div>
      {#if reduxDebugData.extractedAt}
        <div>Extracted: {new Date(reduxDebugData.extractedAt).toLocaleTimeString()}</div>
      {/if}
      
      <div style="margin-top: 8px;"><strong>🔄 REDUX HEALTH</strong></div>
      <div>Version: {reduxDebugData.stateVersion} | Last Action: {reduxDebugData.lastAction}</div>
      <div>Storage: {Math.round(reduxDebugData.storageSize / 1024)}KB | Active Tabs: {reduxDebugData.activeTabsForContent.length}</div>
      
      {#if reduxDebugData.sharedContentId}
        <div style="margin-top: 8px;"><strong>🔗 CROSS-TAB STATE</strong></div>
        <div>Shared Content: ✅ | Same URL Tabs: {reduxDebugData.sameUrlTabs.length}</div>
      {/if}
      
      <!-- Debug buttons -->
      <div style="margin-top: 8px;">
        <button 
          onclick={async () => {
            try {
              console.log('🔧 DEBUG: Manual tab registration triggered');
              const { tabRegistrationService } = await import('../services/tabRegistrationService.js');
              const result = await tabRegistrationService.registerCurrentTab();
              console.log('🔧 DEBUG: Registration result:', result);
              updateDebugData();
            } catch (error) {
              console.error('🔧 DEBUG: Registration failed:', error);
            }
          }}
          class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded mr-2"
        >
          Register Tab
        </button>
        <button 
          onclick={async () => {
            try {
              console.log('🔧 DEBUG: Manual content extraction triggered');
              const { pageExtractionService } = await import('../services/pageExtractionService.js');
              const result = await pageExtractionService.extractCurrentPage();
              console.log('🔧 DEBUG: Extraction result:', result);
              updateDebugData();
            } catch (error) {
              console.error('🔧 DEBUG: Extraction failed:', error);
            }
          }}
          class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded mr-2"
        >
          Extract Content
        </button>
        <button 
          onclick={async () => {
            try {
              console.log('🔧 DEBUG: Current Redux state:', tabDataController.getState());
              console.log('🔧 DEBUG: Current debug data:', reduxDebugData);
              const { reduxInitializationService } = await import('../services/reduxInitializationService.js');
              const health = await reduxInitializationService.getSystemHealth();
              console.log('🔧 DEBUG: System health:', health);
            } catch (error) {
              console.error('🔧 DEBUG: Failed to get system health:', error);
            }
          }}
          class="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded"
        >
          Debug Log
        </button>
      </div>
    </div>
  {:else if isLoading}
    <div class="redux-status loading">
      Loading Redux state...
    </div>
  {:else}
    <div class="redux-status error">
      Redux state not available
    </div>
  {/if}



  <!-- All Tracked Tabs Section -->
  <div class="mb-4">
    <div class="flex flex-col gap-2 mb-2">
      <span class="text-sm font-semibold">📑 All Tracked Tabs ({allTrackedTabs.length})</span>
    </div>
    
    {#if allTrackedTabs.length === 0}
      <div class="tab-card">
        <div class="tab-description">No tabs tracked yet. Visit pages to see them automatically tracked here.</div>
      </div>
    {:else}
      {#each allTrackedTabs as tab (tab.contentId)}
        <div class="tab-card {tab.isCurrentTab ? 'current' : ''}">
          <div class="tab-title">
            {tab.isCurrentTab ? '👁️ ' : ''}{tab.title}
          </div>
          <div class="tab-description">
            {tab.description}
          </div>
          <div class="tab-meta">
            {#if tab.isCurrentTab}
              <span class="current-indicator">CURRENT</span>
            {/if}
            <span>🌐 {tab.domain}</span>
            <span>📝 {tab.wordCount} words</span>
            <span>🔗 {tab.activeTabIds.length} tab{tab.activeTabIds.length !== 1 ? 's' : ''}</span>
            {#if tab.extractedAt}
              <span>⏰ {new Date(tab.extractedAt).toLocaleTimeString()}</span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div class="flex flex-col gap-2 mb-2">
    <ContentStructure />
    <ContentReader />
  </div>

  <div class="space-y-1">
    <CollapsibleContent
      title="Redux State (Full)"
      content={reduxStateContent}
      itemCount="{Object.keys(tabDataState).length} content items"
      emptyMessage="No Redux state available"
      isLoading={isLoading}
    />

    <CollapsibleContent
      title="Debug Panel Data"
      content={debugDataContent}
      itemCount="{reduxDebugData ? Object.keys(reduxDebugData).length : 0} fields"
      emptyMessage="No debug data available"
      isLoading={isLoading}
    />

    <CollapsibleContent
      title="Current Content (Redux)"
      content={currentContentDisplay}
      itemCount="{currentContent ? 'Available' : 'None'}"
      emptyMessage="No current content in Redux state"
      isLoading={isLoading}
    />

    {#if currentContent}
      <CollapsibleContent
        title="Text Content (Redux)"
        content={currentContent.content.text || ''}
        itemCount="{currentContent.content.text?.length || 0} chars"
        emptyMessage="No text content available"
        isLoading={isLoading}
      />

      <CollapsibleContent
        title="HTML Content (Redux)"
        content={currentContent.content.html || ''}
        itemCount="{currentContent.content.html?.length || 0} chars"
        emptyMessage="No HTML content available"
        isLoading={isLoading}
      />

      <CollapsibleContent
        title="Metadata (Redux)"
        content={JSON.stringify(currentContent.content.metadata || {}, null, 2)}
        itemCount="{Object.keys(currentContent.content.metadata || {}).length} fields"
        emptyMessage="No metadata available"
        isLoading={isLoading}
      />

      <CollapsibleContent
        title="Analysis Data (Redux)"
        content={JSON.stringify(currentContent.analysis || {}, null, 2)}
        itemCount="{Object.keys(currentContent.analysis || {}).length} fields"
        emptyMessage="No analysis data available"
        isLoading={isLoading}
      />

      <CollapsibleContent
        title="Processing State (Redux)"
        content={JSON.stringify(currentContent.processing || {}, null, 2)}
        itemCount="{Object.keys(currentContent.processing || {}).length} fields"
        emptyMessage="No processing state available"
        isLoading={isLoading}
      />

      <CollapsibleContent
        title="UI State (Redux)"
        content={JSON.stringify(currentContent.ui || {}, null, 2)}
        itemCount="{Object.keys(currentContent.ui || {}).length} tabs"
        emptyMessage="No UI state available"
        isLoading={isLoading}
      />
    {/if}

    <!-- Legacy Debug Log for comparison -->
    <CollapsibleContent
      title="Legacy Debug Log"
      content={debugLogContent}
      itemCount={$debugLog.length}
      emptyMessage="No debug entries"
      isLoading={false}
    />
  </div> 
</div>  