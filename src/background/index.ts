// Simplified background script - no global state, no broadcasting
// Each side panel instance is isolated and handles its own tab

const PANEL_PATH = 'index.html';

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

// Handle content extraction requests (from side panels)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔧 Background received message:', message);
  
  // Handle content extraction requests
  if (message.action === 'extractContentForCurrentTab') {
    const { tabId } = message;
    handleContentExtraction(tabId, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

async function handleContentExtraction(tabId: number, sendResponse: (response: any) => void) {
  try {
    console.log('🔧 Extracting content for tab:', tabId);
    
    // Get tab info first
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      sendResponse({ success: false, error: 'No URL found for tab' });
      return;
    }
    
    // Try to extract content directly
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('🔍 Content script not available, injecting...', chrome.runtime.lastError.message);
        
        // Inject content script if it doesn't exist
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content-script.js']
        }).then(() => {
          console.log('✅ Content script injected for tab:', tabId);
          
          // Wait a bit for the script to initialize, then try again
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (retryResponse) => {
              if (chrome.runtime.lastError) {
                console.error('❌ Content extraction failed after injection:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
              }
              
              if (retryResponse?.success) {
                console.log('✅ Content extracted successfully after injection');
                sendResponse({ success: true, data: retryResponse.content });
              } else {
                console.error('❌ Content extraction returned failure after injection:', retryResponse);
                sendResponse({ success: false, error: 'Failed to extract content after injection' });
              }
            });
          }, 100);
        }).catch((injectError) => {
          console.error('❌ Failed to inject content script:', injectError);
          const errorMessage = injectError instanceof Error ? injectError.message : String(injectError);
          sendResponse({ success: false, error: 'Failed to inject content script: ' + errorMessage });
        });
        return;
      }
      
      if (response?.success) {
        console.log('✅ Content extracted successfully for tab:', tabId);
        sendResponse({ success: true, data: response.content });
      } else {
        console.error('❌ Content extraction returned failure:', response);
        sendResponse({ success: false, error: 'Failed to extract content' });
      }
    });
    
  } catch (error) {
    console.error('❌ Handle content extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}