<script lang="ts">
  import '@fontsource-variable/eb-garamond';
  import { onMount } from "svelte";

  let tabContent = $state(null);
  let isLoading = $state(false);
  let currentTabId = $state<number | null>(null);
  
  onMount(async () => {
    // Tell background script that side panel is open
    await notifyPanelOpen();
    
    // Load initial content
    await loadCurrentTabContent();
    
    // Set up message listener for auto-updates
    setupMessageListener();
    
    // Listen for tab changes to update currentTabId
    setupTabChangeListener();
  });
  
  async function notifyPanelOpen() {
    try {
      // Get current tab and notify background script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        currentTabId = tabs[0].id;
        
        // Tell background script this tab has side panel open
        await chrome.runtime.sendMessage({
          action: 'sidePanelOpened',
          tabId: tabs[0].id
        });
        
        console.log('🎯 Notified background that side panel is open for tab:', tabs[0].id);
      }
    } catch (error) {
      console.error('Failed to notify panel open:', error);
    }
  }
  
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('🎯 Side panel received message:', message);
      
      if (message.action === 'tabDataReady') {
        console.log('📨 Received auto-updated tab data for tab:', message.tabId);
        console.log('📨 Current tab ID:', currentTabId);
        
        // Update content for any tab (remove the currentTabId check)
        if (message.data?.success) {
          console.log('✅ Updating tab content:', message.data.data);
          tabContent = message.data.data;
          
          // Update currentTabId to match the new content
          currentTabId = message.tabId;
          console.log('📨 Updated currentTabId to:', currentTabId);
        }
        
        sendResponse({ success: true });
        return true;
      }
    });
  }
  
  function setupTabChangeListener() {
    // Listen for tab activation changes
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      console.log('🎯 Side panel detected tab change to:', activeInfo.tabId);
      
      // Update our current tab tracking
      const oldTabId = currentTabId;
      currentTabId = activeInfo.tabId;
      
      console.log('🎯 Tab changed from', oldTabId, 'to', currentTabId);
      
      // The background script will handle content extraction and send us tabDataReady
      // We just need to wait for it
    });
  }
  
  async function loadCurrentTabContent() {
    try {
      isLoading = true;
      
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) return;
      
      currentTabId = tabs[0].id;
      console.log('🎯 Loading content for tab:', currentTabId);
      
      // Request content extraction for this tab
      const response = await chrome.runtime.sendMessage({
        action: 'requestContentForTab',
        tabId: tabs[0].id
      });
      
      console.log('🎯 Content response:', response);
      
      if (response.success) {
        tabContent = response.data;
        console.log('✅ Tab content loaded:', tabContent);
      }
    } catch (error) {
      console.error('Failed to load tab content:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Helper function to refresh current tab content manually
  async function refreshCurrentTab() {
    if (currentTabId) {
      isLoading = true;
      
      const response = await chrome.runtime.sendMessage({
        action: 'requestContentForTab',
        tabId: currentTabId
      });
      
      if (response.success) {
        tabContent = response.data;
      }
      
      isLoading = false;
    }
  }
</script>

<div class="flex flex-col bg-paper min-h-screen">
  <!-- Main Content -->
  <main class="flex-1 px-2 overflow-auto flex flex-col gap-2 min-h-0 flex-grow">
    {#if isLoading}
      <div class="p-4 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p class="mt-2">Loading content...</p>
      </div>
    {:else if tabContent}
      <div class="p-4">
        <div class="mb-4">
          <h2 class="text-xl font-bold mb-2">{tabContent.title}</h2>
          <div class="text-sm text-gray-600 space-y-1">
            <p><strong>URL:</strong> {tabContent.url}</p>
            <p><strong>Word count:</strong> {tabContent.text?.split(' ').length || 0}</p>
            <p><strong>Current Tab ID:</strong> {currentTabId}</p>
          </div>
        </div>
        
        <div class="border-t pt-4">
          <h3 class="font-semibold mb-2">Content Preview:</h3>
          <p class="text-sm bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
            {tabContent.text?.substring(0, 500)}...
          </p>
        </div>
        
        <div class="mt-4">
          <button 
            on:click={refreshCurrentTab}
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Content
          </button>
        </div>
      </div>
    {:else}
      <div class="p-4 text-center text-gray-500">
        <p>No content available</p>
        <button 
          on:click={refreshCurrentTab}
          class="mt-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Try Loading Content
        </button>
      </div>
    {/if}
  </main>
</div>
