import type { TabData } from '../../types/tabData';
import type { TwitterThread } from '../../types/socialMedia';
import { backgroundDataController } from '../index';
import { TwitterExtractionService } from '../../lib/services/twitterExtractionService';

/**
 * Handle Twitter thread extraction with automatic scrolling
 * This combines the extraction with expansion to get the full thread in one action
 */
export async function handleTwitterThreadExtractionWithScroll(
  url: string, 
  maxScrolls: number = 100, 
  scrollDelay: number = 300, 
  sendResponse: (response: any) => void
) {
  try {
    console.log('🐦 Starting Twitter thread extraction with automatic scrolling for URL:', url);

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

    // Validate that this is a Twitter URL
    if (!TwitterExtractionService.isTwitterUrl(url)) {
      console.error('❌ URL is not a supported Twitter URL:', url);
      sendResponse({ 
        success: false, 
        error: 'This URL is not from Twitter/X platform.' 
      });
      return;
    }

    // Set extraction status
    await backgroundDataController.saveData(url, {
      processing: { 
        socialMediaThread: { isExtracting: true, isExpanding: false, error: null }
      }
    });

    // Find the tab with this URL and send message to its content script
    // Use a wildcard pattern to match the URL regardless of query params or hash
    // chrome.tabs.query url field supports simple glob patterns
    let tabs: chrome.tabs.Tab[] = [];
    try {
      // First try exact URL match
      tabs = await chrome.tabs.query({ url: url });
    } catch {
      // URL may not be a valid match pattern
    }

    if (tabs.length === 0) {
      // Fallback: build a match pattern from the URL's origin + pathname
      // This handles cases where query params or tracking params differ
      try {
        const urlObj = new URL(url);
        const matchPattern = `${urlObj.origin}${urlObj.pathname}*`;
        tabs = await chrome.tabs.query({ url: matchPattern });
      } catch {
        // If URL parsing fails, try querying all tabs and matching manually
      }
    }

    if (tabs.length === 0) {
      // Last resort: query all tabs and find one whose URL contains the status ID
      try {
        const statusMatch = url.match(/\/status\/(\d+)/);
        if (statusMatch) {
          const allTabs = await chrome.tabs.query({});
          tabs = allTabs.filter(t => t.url?.includes(`/status/${statusMatch[1]}`));
        }
      } catch {
        // Ignore errors
      }
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

    // Send message to content script to start extraction with scrolling
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractTwitterThreadWithScroll',
      maxScrolls: maxScrolls,
      scrollDelay: scrollDelay
    });

    if (!response.success) {
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: response.error || 'Extraction with scrolling failed' }
        }
      });
      sendResponse({ 
        success: false, 
        error: response.error || 'Twitter extraction with scrolling failed' 
      });
      return;
    }

    const thread = response.thread as TwitterThread;
    
    // The TwitterExtractionService already handles quality assessment and enhancement
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
    
    console.log('🐦 Save result:', saveResult);

    console.log('✅ Twitter thread extracted with scrolling successfully:', {
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
    console.error('❌ Error in Twitter thread extraction with scrolling process:', error);
    
    // ✅ NEW: Only specify the fields we want to update!
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update Twitter thread processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get Twitter thread status for a specific URL
 */
export async function getTwitterThreadStatus(url: string): Promise<any> {
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
    console.error('Failed to get Twitter thread status:', error);
    return { 
      hasThread: false, 
      isExtracting: false, 
      isExpanding: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
} 