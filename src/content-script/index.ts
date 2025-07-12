// Simplified content script - only handles content extraction when requested
import { extractContent } from './tasks/extractContent.svelte';
import { extractPageAssets } from './tasks/extractPageAssets.svelte';
import { extractTwitterThreadWithScroll } from './tasks/extractTwitterThreadWithScroll.svelte';
import { extractLinkedInThreadWithScroll } from './tasks/extractLinkedInThreadWithScroll.svelte';
import { extractMapsData } from './tasks/extractMapsData.svelte';
import { controlMaps } from './tasks/controlMaps.svelte';

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

  // Handle Google Maps data extraction requests
  if (message.action === 'extractMapsData') {
    extractMapsData().then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('🗺️ Maps data extraction failed:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Maps data extraction failed' 
      });
    });
    return true; // Keep message channel open for async response
  }

  // Handle Google Maps control requests
  if (message.action === 'controlMaps') {
    const { command } = message;
    
    controlMaps(command).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('🗺️ Maps control failed:', error);
      sendResponse({ 
        success: false, 
        action: command?.action || 'unknown',
        error: error instanceof Error ? error.message : 'Maps control failed' 
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

  // Handle LinkedIn thread extraction with automatic scrolling and expansion
  if (message.action === 'extractLinkedInThreadWithScroll') {
    const { maxScrolls = 50, scrollDelay = 400, maxExpansions = 100 } = message;
    
    console.log('🔗 Starting LinkedIn thread extraction with scrolling and expansion...');
    
    extractLinkedInThreadWithScroll(maxScrolls, scrollDelay, maxExpansions).then(result => {
      sendResponse(result);
    }).catch((error: any) => {
      console.error('🔗 LinkedIn thread extraction with scrolling failed:', error);
      sendResponse({ 
        success: false, 
        progress: {
          expandedCount: 0,
          totalFound: 0,
          currentStep: 'Extraction failed'
        },
        error: error instanceof Error ? error.message : 'LinkedIn thread extraction failed' 
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