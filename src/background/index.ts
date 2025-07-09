// Simplified background script - no global state, no broadcasting
// Each side panel instance is isolated and handles its own tab

const PANEL_PATH = 'index.html';

import { handleContentExtraction } from './tasks/handleContentExtraction';
import { handleManualContentSetting } from './tasks/handleManualContentSetting';
import { handleBookmarking, getBookmarkStatus } from './tasks/handleBookmarking';
import { handleSummaryGeneration, getSummaryStatus } from './tasks/handleSummaryGeneration';
import { handleContentStructureParsing, getContentStructureStatus } from './tasks/handleContentStructureParsing';
import { handleChatMessage, handleClearChatHistory, getChatStatus } from './tasks/handleChatMessage';
import { DataController } from '../lib/services/dataController';

// Shared data controller instance for background context
export const backgroundDataController = new DataController('background');


// Handle content extraction requests (from side panels)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔧 Background received message:', message);

  // Handle content extraction requests
  if (message.action === 'extractContentForCurrentTab') {
    const { tabId } = message;
    handleContentExtraction(tabId, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle manual content setting
  if (message.action === 'setManualContent') {
    const { url, data } = message;
    handleManualContentSetting(url, data, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle bookmarking requests
  if (message.action === 'bookmarkContent') {
    const { url } = message;
    handleBookmarking(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle bookmark status requests
  if (message.action === 'getBookmarkStatus') {
    const { url } = message;
    getBookmarkStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle summary generation requests
  if (message.action === 'generateSummary') {
    const { url } = message;
    handleSummaryGeneration(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle summary status requests
  if (message.action === 'getSummaryStatus') {
    const { url } = message;
    getSummaryStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle content structure parsing requests
  if (message.action === 'parseContentStructure') {
    const { url } = message;
    handleContentStructureParsing(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle content structure status requests
  if (message.action === 'getContentStructureStatus') {
    const { url } = message;
    getContentStructureStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle chat message requests
  if (message.action === 'sendChatMessage') {
    const { url, message: chatMessage, chatHistory } = message;
    handleChatMessage(url, chatMessage, chatHistory, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle clear chat history requests
  if (message.action === 'clearChatHistory') {
    const { url } = message;
    handleClearChatHistory(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle chat status requests
  if (message.action === 'getChatStatus') {
    const { url } = message;
    getChatStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle load data requests (for refreshing without re-extraction)
  if (message.action === 'loadData') {
    const { url } = message;
    backgroundDataController.loadData(url).then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Data controller messages are handled automatically by the controller instance
  // No need to handle them explicitly here

  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});



// Enable side panel for a specific tab
async function enablePanelForTab(tabId: number) {
  try {
    await chrome.sidePanel.setOptions({ 
      tabId, 
      path: PANEL_PATH, 
      enabled: true 
    });
    console.log('📌 Side panel enabled for tab:', tabId);
  } catch (error) {
    console.error('Failed to enable panel for tab', tabId, ':', error);
  }
}

// Enable side panel for all existing tabs on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extension installed, enabling panels for all tabs');
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        enablePanelForTab(tab.id);
      }
    });
  });
});

// Enable side panel for new tabs
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id) {
    console.log('📌 New tab created:', tab.id);
    enablePanelForTab(tab.id);
  }
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  console.log('🔧 Extension icon clicked for tab:', tab.id);
  
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
    
    // Notify content script that sidebar opened (for any cleanup if needed)
    chrome.tabs.sendMessage(tab.id, { action: 'sidebarOpened' }).catch(() => {
      // Content script might not be ready yet
    });
  }
});
