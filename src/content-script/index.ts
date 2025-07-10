// Simplified content script - only handles content extraction when requested
import { extractContent } from './tasks/extractContent.svelte';
import { extractPageAssets } from './tasks/extractPageAssets.svelte';
import { extractTwitterThread, expandTwitterThread } from './tasks/extractTwitterThread.svelte';
import { extractTwitterThreadWithScroll } from './tasks/extractTwitterThreadWithScroll.svelte';

// Import debug functions for testing
import './tasks/debugScrollCapture.svelte';

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

  // Handle page assets extraction requests
  if (message.action === 'extractPageAssets') {
    extractPageAssets().then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('🎨 Page assets extraction failed:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Page assets extraction failed' 
      });
    });
    return true; // Keep message channel open for async response
  }

  // Handle Twitter thread extraction requests
  if (message.action === 'extractTwitterThread') {
    extractTwitterThread().then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('🐦 Twitter thread extraction failed:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Twitter thread extraction failed' 
      });
    });
    return true; // Keep message channel open for async response
  }

  // Handle Twitter thread extraction with automatic scrolling
  if (message.action === 'extractTwitterThreadWithScroll') {
    const { maxScrolls = 100, scrollDelay = 300 } = message;
    
    console.log('🐦 Starting Twitter thread extraction with scrolling...');
    
    extractTwitterThreadWithScroll(maxScrolls, scrollDelay).then(result => {
      sendResponse(result);
    }).catch((error: any) => {
      console.error('🐦 Twitter thread extraction with scrolling failed:', error);
      sendResponse({ 
        success: false, 
        progress: {
          expandedCount: 0,
          totalFound: 0,
          currentStep: 'Extraction failed'
        },
        error: error instanceof Error ? error.message : 'Twitter thread extraction failed' 
      });
    });
    
    return true; // Keep message channel open for async response
  }

  // Handle Twitter thread expansion requests
  if (message.action === 'expandTwitterThread') {
    const { currentThreadId, maxPosts } = message;
    expandTwitterThread(currentThreadId, maxPosts).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('🐦 Twitter thread expansion failed:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Twitter thread expansion failed' 
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