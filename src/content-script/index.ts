// Simplified content script - only handles content extraction when requested
import { extractContent } from './tasks/extractContent.svelte';
import { extractPageAssets } from './tasks/extractPageAssets.svelte';
import { extractTwitterThreadWithScroll } from './tasks/extractTwitterThreadWithScroll.svelte';
import { extractLinkedInThreadWithScroll } from './tasks/extractLinkedInThreadWithScroll.svelte';
import { extractMapsData } from './tasks/extractMapsData.svelte';
import { controlMaps } from './tasks/controlMaps.svelte';
import { extractRedditThread } from './tasks/extractRedditThread';

// Import debug functions for testing
import './tasks/debugScrollCapture.svelte';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📄 Content script received message:', message);

  // Guard against double-calling sendResponse on error paths
  let responded = false;
  const respond = (data: any) => {
    if (responded) return;
    responded = true;
    sendResponse(data);
  };

  // Handle content extraction requests
  if (message.action === 'extractContent') {
    extractContent().then(result => {
      respond(result);
    }).catch(error => {
      console.error('📄 Content extraction failed:', error);
      respond({
        success: false,
        error: error instanceof Error ? error.message : 'Content extraction failed'
      });
    });
    return true; // Keep message channel open for async response
  }

  // Handle page assets extraction requests
  if (message.action === 'extractPageAssets') {
    extractPageAssets().then(result => {
      respond(result);
    }).catch(error => {
      console.error('🎨 Page assets extraction failed:', error);
      respond({
        success: false,
        error: error instanceof Error ? error.message : 'Page assets extraction failed'
      });
    });
    return true; // Keep message channel open for async response
  }

  // Handle Google Maps data extraction requests
  if (message.action === 'extractMapsData') {
    extractMapsData().then(result => {
      respond(result);
    }).catch(error => {
      console.error('🗺️ Maps data extraction failed:', error);
      respond({
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
      respond(result);
    }).catch(error => {
      console.error('🗺️ Maps control failed:', error);
      respond({
        success: false,
        action: command?.action || 'unknown',
        error: error instanceof Error ? error.message : 'Maps control failed'
      });
    });
    return true; // Keep message channel open for async response
  }

  // Background-assisted navigation fallback (when tabs.update fails)
  if (message.action === 'navigateToUrl') {
    try {
      const { url } = message;
      if (typeof url === 'string' && url) {
        // Validate URL scheme to prevent javascript:/data: injection
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
            respond({ success: false, error: `Blocked unsafe URL scheme: ${parsed.protocol}` });
            return true;
          }
        } catch { respond({ success: false, error: 'Invalid URL' }); return true; }
        window.location.href = url;
        respond({ success: true, method: 'window.location' });
      } else {
        respond({ success: false, error: 'Invalid URL' });
      }
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Navigation failed' });
    }
    return true;
  }

  // Handle Twitter thread extraction with automatic scrolling
  if (message.action === 'extractTwitterThreadWithScroll') {
    const { maxScrolls = 100, scrollDelay = 300 } = message;

    console.log('🐦 Starting Twitter thread extraction with scrolling...');

    extractTwitterThreadWithScroll(maxScrolls, scrollDelay).then(result => {
      respond(result);
    }).catch((error: any) => {
      console.error('🐦 Twitter thread extraction with scrolling failed:', error);
      respond({
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
      respond(result);
    }).catch((error: any) => {
      console.error('🔗 LinkedIn thread extraction with scrolling failed:', error);
      respond({
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

  // Handle Reddit thread extraction via defuddle
  if (message.action === 'extractRedditThread') {
    console.log('🔴 Starting Reddit thread extraction via defuddle...');

    extractRedditThread().then(result => {
      respond(result);
    }).catch((error: any) => {
      console.error('🔴 Reddit thread extraction failed:', error);
      respond({
        success: false,
        error: error instanceof Error ? error.message : 'Reddit thread extraction failed'
      });
    });

    return true; // Keep message channel open for async response
  }

  // Handle sidebar opened notification (for any cleanup if needed)
  if (message.action === 'sidebarOpened') {
    console.log('📄 Sidebar opened for this tab');
    respond({ success: true });
    return true;
  }

  // Unknown message
  respond({ success: false, error: 'Unknown action' });
  return true;
});