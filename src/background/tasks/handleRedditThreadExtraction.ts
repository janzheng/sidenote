import type { RedditThread } from '../../types/socialMedia';
import { backgroundDataController } from '../index';

/**
 * Check if a URL is a Reddit URL
 */
export function isRedditUrl(url: string): boolean {
  return /reddit\.com/i.test(url) || /old\.reddit\.com/i.test(url);
}

/**
 * Handle Reddit thread extraction via defuddle's Reddit extractor
 */
export async function handleRedditThreadExtraction(
  url: string,
  sendResponse: (response: any) => void
) {
  try {
    console.log('🔴 Starting Reddit thread extraction for URL:', url);

    // Set extraction status
    await backgroundDataController.saveData(url, {
      processing: {
        socialMediaThread: { isExtracting: true, isExpanding: false, error: null }
      }
    });

    // Find the tab with this URL
    let tabs: chrome.tabs.Tab[] = [];
    try {
      tabs = await chrome.tabs.query({ url: `*://*.reddit.com/*` });
      // Filter to find the tab matching our URL
      const urlObj = new URL(url);
      tabs = tabs.filter(t => {
        if (!t.url) return false;
        try {
          const tabUrl = new URL(t.url);
          return tabUrl.pathname === urlObj.pathname;
        } catch {
          return false;
        }
      });
    } catch {
      // Ignore query errors
    }

    if (tabs.length === 0) {
      await backgroundDataController.saveData(url, {
        processing: {
          socialMediaThread: { isExtracting: false, isExpanding: false, error: 'No active Reddit tab found' }
        }
      });
      sendResponse({ success: false, error: 'No active Reddit tab found' });
      return;
    }

    const tab = tabs[0];
    if (!tab.id) {
      await backgroundDataController.saveData(url, {
        processing: {
          socialMediaThread: { isExtracting: false, isExpanding: false, error: 'Tab ID not found' }
        }
      });
      sendResponse({ success: false, error: 'Tab ID not found' });
      return;
    }

    // Send message to content script
    let response: any;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractRedditThread'
      });
    } catch {
      // Content script not injected — inject and retry
      console.warn('⚠️ Content script not found for Reddit extraction, injecting...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script.js']
        });
        await new Promise(r => setTimeout(r, 300));
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'extractRedditThread'
        });
      } catch (retryErr) {
        response = { success: false, error: 'Content script not available. Try refreshing the page.' };
      }
    }

    if (!response?.success) {
      await backgroundDataController.saveData(url, {
        processing: {
          socialMediaThread: { isExtracting: false, isExpanding: false, error: response?.error || 'Reddit extraction failed' }
        }
      });
      sendResponse({ success: false, error: response?.error || 'Reddit extraction failed' });
      return;
    }

    const thread = response.thread as RedditThread;

    // Save the extracted thread
    await backgroundDataController.saveData(url, {
      analysis: {
        socialMediaThread: thread
      },
      processing: {
        socialMediaThread: { isExtracting: false, isExpanding: false, error: null }
      }
    });

    console.log('✅ Reddit thread extracted successfully:', {
      title: thread.title,
      subreddit: thread.redditData?.subreddit,
      posts: thread.posts.length,
    });

    sendResponse({ success: true, thread });

  } catch (error) {
    console.error('❌ Error in Reddit thread extraction:', error);

    try {
      await backgroundDataController.saveData(url, {
        processing: {
          socialMediaThread: { isExtracting: false, isExpanding: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update Reddit thread processing status:', saveError);
    }

    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Get Reddit thread status for a specific URL
 */
export async function getRedditThreadStatus(url: string): Promise<any> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      return { hasThread: false, isExtracting: false, error: null };
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
    console.error('Failed to get Reddit thread status:', error);
    return {
      hasThread: false,
      isExtracting: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
