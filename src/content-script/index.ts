// Simplified content script - only handles content extraction when requested
import { extractContent } from './tasks/extractContent';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📄 Content script received message:', message);
  
  // Handle content extraction requests
  if (message.action === 'extractContent') {
    extractContent().then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('📄 Content extraction failed:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Content extraction failed' 
      });
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle sidebar opened notification (for any cleanup if needed)
  if (message.action === 'sidebarOpened') {
    console.log('📄 Sidebar opened for this tab');
    sendResponse({ success: true });
    return true;
  }
  
  // Unknown message
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});