import { backgroundDataController } from '../index';

export async function handleContentExtraction(tabId: number, sendResponse: (response: any) => void) {
  try {
    console.log('🔧 Extracting content for tab:', tabId);
    
    // Get tab info first
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      sendResponse({ success: false, error: 'No URL found for tab' });
      return;
    }
    
    // Try to extract content directly
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, async (response) => {
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
            chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, async (retryResponse) => {
              if (chrome.runtime.lastError) {
                console.error('❌ Content extraction failed after injection:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
              }
              
              if (retryResponse?.success) {
                console.log('✅ Content extracted successfully after injection');
                // Load the full TabData from data controller to include statuses
                const fullTabData = tab.url ? await backgroundDataController.loadData(tab.url, true) : null;
                
                if (fullTabData) {
                  sendResponse({ success: true, data: fullTabData });
                } else {
                  sendResponse({ success: true, data: retryResponse.content });
                }
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
        // Load the full TabData from data controller to include statuses
        const fullTabData = tab.url ? await backgroundDataController.loadData(tab.url, true) : null;
        
        if (fullTabData) {
          sendResponse({ success: true, data: fullTabData });
        } else {
          sendResponse({ success: true, data: response.content });
        }
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