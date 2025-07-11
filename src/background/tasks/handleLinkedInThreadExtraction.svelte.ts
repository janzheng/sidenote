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

    // Find the tab with this URL and send message to its content script
    const tabs = await chrome.tabs.query({ url: url });
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

    // Send message to content script to start extraction with scrolling and expansion
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractLinkedInThreadWithScroll',
      maxScrolls: maxScrolls,
      scrollDelay: scrollDelay,
      maxExpansions: maxExpansions
    });

    if (!response.success) {
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: response.error || 'Extraction with scrolling failed' }
        }
      });
      sendResponse({ 
        success: false, 
        error: response.error || 'LinkedIn extraction with scrolling failed' 
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