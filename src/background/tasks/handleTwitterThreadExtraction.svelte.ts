import type { TabData } from '../../types/tabData';
import type { TwitterThread } from '../../types/socialMedia';
import { backgroundDataController } from '../index';
import { TwitterExtractionService } from '../../lib/services/twitterExtractionService';

/**
 * Handle Twitter thread extraction request for a specific URL
 */
export async function handleTwitterThreadExtraction(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🐦 Starting Twitter thread extraction for URL:', url);

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

    // Log current Twitter status before update
    console.log('🐦 Current Twitter status:', tabData.processing?.socialMediaThread);
    
    // ✅ NEW: Only specify the fields we want to update!
    await backgroundDataController.saveData(url, {
      processing: { 
        socialMediaThread: { isExtracting: true, isExpanding: false, error: null }
      }
    });

    // Use the TwitterExtractionService to extract thread
    const extractionResult = await TwitterExtractionService.extractThread(tabData);
    
    if (extractionResult.success && extractionResult.thread) {
      // ✅ NEW: Only specify the fields we want to update!
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { 
          socialMediaThread: extractionResult.thread
        },
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: null }
        }
      });
      
      console.log('🐦 Save result:', saveResult);
      
      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
      console.log('🐦 Verified Twitter thread after save:', {
        hasThread: !!verifyData?.analysis?.socialMediaThread,
        threadId: verifyData?.analysis?.socialMediaThread?.id,
        postCount: verifyData?.analysis?.socialMediaThread?.posts?.length || 0
      });

      console.log('✅ Twitter thread extracted successfully');
      sendResponse({ 
        success: true, 
        thread: extractionResult.thread
      });
    } else {
      // ✅ NEW: Only specify the fields we want to update!
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: extractionResult.error || 'Unknown error' }
        }
      });
      
      console.error('❌ Twitter thread extraction failed:', extractionResult.error);
      sendResponse({ 
        success: false, 
        error: extractionResult.error || 'Failed to extract Twitter thread' 
      });
    }

  } catch (error) {
    console.error('❌ Error in Twitter thread extraction process:', error);
    
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
 * Handle Twitter thread expansion request for a specific URL
 */
export async function handleTwitterThreadExpansion(url: string, currentThreadId?: string, maxPosts?: number, sendResponse?: (response: any) => void) {
  try {
    console.log('🐦 Starting Twitter thread expansion for URL:', url);

    // First, load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData || !tabData.analysis?.socialMediaThread) {
      console.error('❌ No Twitter thread found for URL:', url);
      sendResponse?.({ 
        success: false, 
        error: 'No Twitter thread found. Please extract thread first.' 
      });
      return;
    }

    const currentThread = tabData.analysis.socialMediaThread as TwitterThread;

    // ✅ NEW: Only specify the fields we want to update!
    await backgroundDataController.saveData(url, {
      processing: { 
        socialMediaThread: { isExtracting: false, isExpanding: true, error: null }
      }
    });

    // Use the TwitterExtractionService to expand thread
    const expansionResult = await TwitterExtractionService.expandThread(url, currentThread);
    
    if (expansionResult.success) {
      // Update the thread with additional posts if any were found
      let updatedThread = currentThread;
      
      if (expansionResult.additionalPosts && expansionResult.additionalPosts.length > 0) {
        updatedThread = {
          ...currentThread,
          posts: [...currentThread.posts, ...expansionResult.additionalPosts],
          // Recalculate total engagement
          totalEngagement: {
            likes: currentThread.totalEngagement.likes + expansionResult.additionalPosts.reduce((sum, post) => sum + post.engagement.likes, 0),
            reposts: currentThread.totalEngagement.reposts + expansionResult.additionalPosts.reduce((sum, post) => sum + post.engagement.reposts, 0),
            replies: currentThread.totalEngagement.replies + expansionResult.additionalPosts.reduce((sum, post) => sum + post.engagement.replies, 0),
            views: (currentThread.totalEngagement.views || 0) + expansionResult.additionalPosts.reduce((sum, post) => sum + (post.engagement.views || 0), 0)
          }
        };
      }

      // ✅ NEW: Only specify the fields we want to update!
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { 
          socialMediaThread: updatedThread
        },
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: null }
        }
      });
      
      console.log('🐦 Expansion save result:', saveResult);

      console.log('✅ Twitter thread expansion completed successfully');
      sendResponse?.({ 
        success: true, 
        additionalPosts: expansionResult.additionalPosts,
        updatedThread: updatedThread,
        progress: expansionResult.progress
      });
    } else {
      // ✅ NEW: Only specify the fields we want to update!
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: expansionResult.error || 'Unknown error' }
        }
      });
      
      console.error('❌ Twitter thread expansion failed:', expansionResult.error);
      sendResponse?.({ 
        success: false, 
        error: expansionResult.error || 'Failed to expand Twitter thread' 
      });
    }

  } catch (error) {
    console.error('❌ Error in Twitter thread expansion process:', error);
    
    // ✅ NEW: Only specify the fields we want to update!
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          socialMediaThread: { isExtracting: false, isExpanding: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update Twitter thread expansion status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse?.({ success: false, error: errorMessage });
  }
}

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
    console.error('❌ Error in Twitter thread extraction with scrolling:', error);
    
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