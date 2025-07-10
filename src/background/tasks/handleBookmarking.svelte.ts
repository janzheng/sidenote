import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';
import { BookmarkService } from '../../lib/services/bookmarkService.svelte';

/**
 * Handle bookmark request for a specific URL
 */
export async function handleBookmarking(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🔖 Starting bookmark process for URL:', url);

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

    // Log current bookmark status before update
    console.log('🔖 Current bookmark status:', tabData.statuses?.bookmarkStatus);
    
    // Use the new BookmarkService to send to sheet API
    const bookmarkResult = await BookmarkService.bookmarkTabData(tabData);
    
    if (bookmarkResult.success) {
      // Update bookmark status to success
      const saveResult = await backgroundDataController.saveData(url, {
        statuses: { bookmarkStatus: 'success' }
      });
      
      console.log('🔖 Save result:', saveResult);
      
      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
      console.log('🔖 Verified bookmark status after save:', verifyData?.statuses?.bookmarkStatus);

      console.log('✅ Bookmark saved successfully');
      sendResponse({ 
        success: true, 
        message: bookmarkResult.message || 'Content bookmarked successfully',
        bookmarkId: bookmarkResult.bookmarkId 
      });
    } else {
      // Update bookmark status to error
      await backgroundDataController.saveData(url, {
        statuses: { bookmarkStatus: 'error' }
      });
      
      console.error('❌ Bookmark API failed:', bookmarkResult.error);
      sendResponse({ 
        success: false, 
        error: bookmarkResult.error || 'Failed to bookmark content' 
      });
    }

  } catch (error) {
    console.error('❌ Error in bookmark process:', error);
    
    // Update bookmark status to error
    try {
      await backgroundDataController.saveData(url, {
        statuses: { bookmarkStatus: 'error' }
      });
    } catch (saveError) {
      console.error('❌ Failed to update bookmark status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}



/**
 * Get bookmark status for a URL
 */
export async function getBookmarkStatus(url: string): Promise<'not-bookmarked' | 'success' | 'error' | null> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return tabData?.statuses?.bookmarkStatus || null;
  } catch (error) {
    console.error('❌ Error getting bookmark status:', error);
    return null;
  }
} 