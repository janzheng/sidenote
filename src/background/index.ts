import type { TabData } from '../types/tabData';
import { generateContentId } from '../lib/utils/contentId';

// Enhanced tab data management
const tabDataState = new Map<string, TabData>(); // contentId -> TabData
const activeTabsMap = new Map<number, string>(); // tabId -> contentId

// Track which tabs have the side panel open
const sidePanelOpenTabs = new Set<number>();

// Handle tab data operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔧 Background received message:', message, 'from:', sender);
  console.log('🔧 Message action:', message.action);
  console.log('🔧 Current sidePanelOpenTabs before processing:', Array.from(sidePanelOpenTabs));
  
  // Handle side panel opened notification
  if (message.action === 'sidePanelOpened') {
    const { tabId } = message;
    console.log('🔧 Processing sidePanelOpened for tabId:', tabId);
    sidePanelOpenTabs.add(tabId);
    console.log('📌 Side panel opened for tab:', tabId);
    console.log('📌 All tabs with open panels:', Array.from(sidePanelOpenTabs));
    sendResponse({ success: true });
    return true;
  }
  
  // Handle tab data requests
  if (message.action === 'getTabData') {
    const { contentId } = message;
    const tabData = tabDataState.get(contentId);
    sendResponse({ success: true, data: tabData });
    return true;
  }
  
  // Handle tab data updates
  if (message.action === 'updateTabData') {
    const { contentId, data, tabId } = message;
    
    // Update tab data
    tabDataState.set(contentId, data);
    
    // Track active tabs
    if (tabId) {
      activeTabsMap.set(tabId, contentId);
    }
    
    // Broadcast to all tabs viewing this content
    broadcastToTabs(contentId, { action: 'tabDataUpdated', data });
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle concurrent operations
  if (message.action === 'startConcurrentOperation') {
    const { contentId, operationType, tabId } = message;
    
    // Queue operation for specific content
    queueOperation(contentId, operationType, tabId);
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle getCurrentTab requests
  if (message.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          success: true,
          tabId: tabs[0].id,
          url: tabs[0].url,
          title: tabs[0].title
        });
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle content requests
  if (message.action === 'requestContentForTab') {
    const { tabId } = message;
    handleContentRequest(tabId, sendResponse);
    return true;
  }
  
  // Handle other messages...
  sendResponse({ success: true });
  return true;
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('🔧 Tab updated:', tabId, tab.url);
    // You can add tab-specific logic here
  }
});

// Broadcast updates to all tabs viewing the same content
function broadcastToTabs(contentId: string, message: any) {
  const relevantTabs = Array.from(activeTabsMap.entries())
    .filter(([_, cId]) => cId === contentId)
    .map(([tabId, _]) => tabId);
  
  relevantTabs.forEach(tabId => {
    chrome.tabs.sendMessage(tabId, message).catch(() => {
      // Tab might be closed, remove from tracking
      activeTabsMap.delete(tabId);
    });
  });
}

// Queue for concurrent operations
const operationQueue = new Map<string, Array<{
  type: string;
  tabId: number;
  timestamp: number;
  promise: Promise<any>;
}>>();

function queueOperation(contentId: string, operationType: string, tabId: number) {
  if (!operationQueue.has(contentId)) {
    operationQueue.set(contentId, []);
  }
  
  const operation = {
    type: operationType,
    tabId,
    timestamp: Date.now(),
    promise: executeOperation(contentId, operationType, tabId)
  };
  
  operationQueue.get(contentId)!.push(operation);
  
  // Clean up completed operations
  operation.promise.finally(() => {
    const queue = operationQueue.get(contentId);
    if (queue) {
      const index = queue.indexOf(operation);
      if (index > -1) {
        queue.splice(index, 1);
      }
    }
  });
}

async function executeOperation(contentId: string, operationType: string, tabId: number) {
  // Execute the operation based on type
  // switch (operationType) {
  //   case 'extractMetadata':
  //     return await extractMetadataForContent(contentId, tabId);
  //   case 'generateSummary':
  //     return await generateSummaryForContent(contentId, tabId);
  //   case 'extractCitations':
  //     return await extractCitationsForContent(contentId, tabId);
  //   default:
  //     throw new Error(`Unknown operation type: ${operationType}`);
  // }
}

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  console.log('🔧 Extension icon clicked for tab:', tab.id);
  
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
    
    // Mark this tab as having an open side panel
    sidePanelOpenTabs.add(tab.id);
    console.log('📌 Side panel opened for tab:', tab.id);
    console.log('📌 Tabs with open panels:', Array.from(sidePanelOpenTabs));
    
    // Notify content script
    chrome.tabs.sendMessage(tab.id, { action: 'sidebarOpened' }).catch(() => {
      // Content script might not be ready yet
    });
  }
});

async function handleContentRequest(tabId: number, sendResponse: (response: any) => void) {
  try {
    // Get tab info first
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      sendResponse({ success: false, error: 'No URL found for tab' });
      return;
    }
    
    const contentId = generateContentId(tab.url);
    
    // Check if we already have recent data (cache for 1 minute)
    const existingData = tabDataState.get(contentId);
    if (existingData && (Date.now() - existingData.meta.lastUpdated) < 60000) {
      sendResponse({ success: true, contentId, data: existingData.content });
      return;
    }
    
    // Try to ping the content script first
    console.log('🔍 Checking if content script exists for tab:', tabId);
    
    try {
      // Test if content script is responsive
      const pingResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      console.log('🔍 Content script ping response:', pingResponse);
    } catch (pingError) {
      console.log('🔍 Content script not responsive, injecting...', pingError);
      
      // Inject content script if it doesn't exist
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content-script.js']
        });
        console.log('✅ Content script injected for tab:', tabId);
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (injectError) {
        console.error('❌ Failed to inject content script:', injectError);
        sendResponse({ success: false, error: 'Failed to inject content script: ' + injectError.message });
        return;
      }
    }
    
    // Now try to extract content
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Content extraction failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      if (response?.success) {
        console.log('✅ Content extracted successfully for tab:', tabId);
        // Store the data
        const tabData = {
          content: response.content,
          meta: {
            contentId,
            activeTabIds: new Set([tabId]),
            lastUpdated: Date.now()
          }
        };
        
        tabDataState.set(contentId, tabData as TabData);
        activeTabsMap.set(tabId, contentId);
        
        sendResponse({ success: true, contentId, data: response.content });
      } else {
        console.error('❌ Content extraction returned failure:', response);
        sendResponse({ success: false, error: 'Failed to extract content' });
      }
    });
    
  } catch (error) {
    console.error('❌ Handle content request error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Add these tab listeners to your background script

// Listen for tab activation (user switches to different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('🔄 Tab activated:', activeInfo.tabId);
  debugTabTracking();
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    console.log('🔄 Active tab URL:', tab.url);
    
    // Check if ANY tab has the side panel open
    const hasAnyPanelOpen = sidePanelOpenTabs.size > 0;
    console.log('🔄 Has any panel open?', hasAnyPanelOpen);
    
    if (hasAnyPanelOpen) {
      // Auto-register this tab for side panel
      sidePanelOpenTabs.add(activeInfo.tabId);
      console.log('📌 Auto-registered side panel for new tab:', activeInfo.tabId);
      console.log('📌 All tabs with open panels:', Array.from(sidePanelOpenTabs));
      
      // Auto-extract content for the newly active tab
      console.log('✅ Auto-extracting content for tab:', activeInfo.tabId);
      handleContentRequest(activeInfo.tabId, (response) => {
        console.log('🔄 Sending tab data ready:', response);
        // Broadcast to side panel that new tab data is ready
        chrome.runtime.sendMessage({
          action: 'tabDataReady',
          tabId: activeInfo.tabId,
          data: response
        }).catch((error) => {
          console.log('Side panel might not be listening:', error);
        });
      });
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

// Listen for tab URL changes (same tab, different URL)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes and page is complete
  if (changeInfo.status === 'complete' && changeInfo.url) {
    console.log('🔄 Tab URL changed:', tabId, changeInfo.url);
    
    // Check if side panel is open for this tab
    const isPanelOpen = await isSidePanelOpen(tabId);
    if (isPanelOpen) {
      // Auto-extract content for the updated URL
      await handleContentRequest(tabId, (response) => {
        chrome.runtime.sendMessage({
          action: 'tabDataReady',
          tabId: tabId,
          data: response
        }).catch(() => {
          // Side panel might not be listening
        });
      });
    }
  }
});

// Helper function to check if side panel is open
async function isSidePanelOpen(tabId: number): Promise<boolean> {
  const isOpen = sidePanelOpenTabs.has(tabId);
  console.log('🔍 Checking if panel open for tab', tabId, ':', isOpen);
  return isOpen;
}

// Add debug function
function debugTabTracking() {
  console.log('📊 Tabs with open side panels:', Array.from(sidePanelOpenTabs));
  console.log('📊 Active tabs map:', Array.from(activeTabsMap.entries()));
  console.log('📊 Tab data state keys:', Array.from(tabDataState.keys()));
}