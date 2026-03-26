import type { TabData } from '../../types/tabData';
import type { LinkedInThread } from '../../types/socialMedia';
import { backgroundDataController } from '../index';
import { LinkedInExtractionService } from '../../lib/services/linkedInExtractionService';

/**
 * Handle LinkedIn thread extraction with automatic scrolling and expansion
 * This combines the extraction with expansion to get the full thread in one action
 */
export async function handleLinkedInThreadExtractionWithScroll(
  url: string, 
  maxScrolls: number = 50, 
  scrollDelay: number = 400, 
  maxExpansions: number = 100,
  sendResponse: (response: any) => void
) {
  try {
    console.log('🔗 Starting LinkedIn thread extraction with automatic scrolling and expansion for URL:', url);

    // First, load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      });
      return;
    }

    // Validate that this is a LinkedIn URL
    if (!LinkedInExtractionService.isLinkedInUrl(url)) {
      console.error('❌ URL is not a supported LinkedIn URL:', url);
      sendResponse({ 
        success: false, 
        error: 'This URL is not from LinkedIn platform.' 
      });
      return;
    }

    // Set extraction status
    await backgroundDataController.saveData(url, {
      processing: { 
        socialMediaThread: { isExtracting: true, isExpanding: false, error: null }
      }
    });

    // Find the tab with this URL
    // Use a wildcard pattern for chrome.tabs.query since LinkedIn URLs often have
    // tracking parameters (lipi, trk, miniProfileUrn, etc.) that differ between
    // the stored URL and the actual tab URL
    let tabs: chrome.tabs.Tab[] = [];
    try {
      // First try: exact URL match
      tabs = await chrome.tabs.query({ url: url });

      // Second try: use origin + pathname pattern (ignore query params)
      if (tabs.length === 0) {
        const urlObj = new URL(url);
        const pattern = `${urlObj.origin}${urlObj.pathname}*`;
        tabs = await chrome.tabs.query({ url: pattern });
      }

      // Third try: query all LinkedIn tabs and match by pathname
      if (tabs.length === 0) {
        const allLinkedInTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
        const urlObj = new URL(url);
        tabs = allLinkedInTabs.filter(t => {
          try {
            if (!t.url) return false;
            const tabUrl = new URL(t.url);
            return tabUrl.pathname === urlObj.pathname;
          } catch { return false; }
        });
      }
    } catch (queryError) {
      console.warn('Tab query error, falling back to active tab:', queryError);
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    }

    if (tabs.length === 0) {
      await backgroundDataController.saveData(url, {
        processing: {
          socialMediaThread: { isExtracting: false, isExpanding: false, error: 'No active tab found' }
        }
      });
      sendResponse({
        success: false,
        error: 'No active tab found for this URL'
      });
      return;
    }

    const tab = tabs[0];
    if (!tab.id) {
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: 'Tab ID not found' }
        }
      });
      sendResponse({ 
        success: false, 
        error: 'Tab ID not found' 
      });
      return;
    }

    // Send message to content script with auto-injection fallback
    let response: any;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractLinkedInThreadWithScroll',
        maxScrolls, scrollDelay, maxExpansions
      });
    } catch {
      // Content script not injected — inject and retry
      console.warn('⚠️ Content script not found for LinkedIn extraction, injecting...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script.js']
        });
        await new Promise(r => setTimeout(r, 300));
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'extractLinkedInThreadWithScroll',
          maxScrolls, scrollDelay, maxExpansions
        });
      } catch (retryErr) {
        response = { success: false, error: 'Content script not available. Try refreshing the page.' };
      }
    }

    if (!response || !response.success) {
      const errorMsg = response?.error || 'Extraction with scrolling failed (no response from content script)';
      await backgroundDataController.saveData(url, {
        processing: {
          socialMediaThread: { isExtracting: false, isExpanding: false, error: errorMsg }
        }
      });
      sendResponse({
        success: false,
        error: errorMsg
      });
      return;
    }

    const thread = response.thread as LinkedInThread;
    
    // The LinkedInExtractionService already handles quality assessment and enhancement
    const enhancedThread = thread;

    // Save the extracted thread
    const saveResult = await backgroundDataController.saveData(url, {
      analysis: { 
        socialMediaThread: enhancedThread
      },
      processing: { 
        socialMediaThread: { isExtracting: false, isExpanding: false, error: null }
      }
    });
    
    console.log('🔗 Save result:', saveResult);

    console.log('✅ LinkedIn thread extracted with scrolling successfully:', {
      id: enhancedThread.id,
      posts: enhancedThread.posts.length,
      author: enhancedThread.author.username
    });

    sendResponse({ 
      success: true, 
      thread: enhancedThread,
      progress: response.progress
    });

  } catch (error) {
    console.error('❌ Error in LinkedIn thread extraction with scrolling:', error);
    
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update LinkedIn thread processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get LinkedIn thread status for a specific URL
 */
export async function getLinkedInThreadStatus(url: string): Promise<any> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      return { hasThread: false, isExtracting: false, isExpanding: false, error: null };
    }

    return {
      hasThread: !!tabData.analysis?.socialMediaThread,
      threadId: tabData.analysis?.socialMediaThread?.id,
      postCount: tabData.analysis?.socialMediaThread?.posts?.length || 0,
      isExtracting: tabData.processing?.socialMediaThread?.isExtracting || false,
      isExpanding: tabData.processing?.socialMediaThread?.isExpanding || false,
      error: tabData.processing?.socialMediaThread?.error || null
    };
  } catch (error) {
    console.error('Failed to get LinkedIn thread status:', error);
    return { 
      hasThread: false, 
      isExtracting: false, 
      isExpanding: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
} 