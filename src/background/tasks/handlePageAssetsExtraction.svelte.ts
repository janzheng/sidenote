import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';

/**
 * Handle page assets extraction request for a specific URL
 */
export async function handlePageAssetsExtraction(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🎨 Starting page assets extraction for URL:', url);

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

    // Check if we have content to extract assets from
    if (!tabData.content?.html || tabData.content.html.trim().length === 0) {
      console.error('❌ No HTML content found for URL:', url);
      sendResponse({
        success: false,
        error: 'No HTML content available to extract assets from.'
      });
      return;
    }

    console.log('🎨 Current page assets status:', tabData.processing?.pageAssets);

    await backgroundDataController.saveData(url, {
      processing: {
        pageAssets: { isExtracting: true, error: null }
      }
    });

    // Find a tab with this URL
    const tabs = await chrome.tabs.query({ url: url });
    if (tabs.length === 0) {
      console.error('❌ No tabs found for URL:', url);
      await backgroundDataController.saveData(url, {
        processing: { pageAssets: { isExtracting: false, error: 'No active tab found for this URL' } }
      });
      sendResponse({ success: false, error: 'No active tab found for this URL' });
      return;
    }

    const tab = tabs[0];
    if (!tab.id) {
      console.error('❌ Tab ID not found');
      await backgroundDataController.saveData(url, {
        processing: { pageAssets: { isExtracting: false, error: 'Tab ID not found' } }
      });
      sendResponse({ success: false, error: 'Tab ID not found' });
      return;
    }

    // Send message to content script
    // Send message to content script with auto-injection fallback
    let response: any;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPageAssets' });
    } catch {
      // Content script not injected — inject and retry
      console.warn('⚠️ Content script not found for page assets, injecting...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script.js']
        });
        await new Promise(r => setTimeout(r, 300));
        response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPageAssets' });
      } catch (retryErr) {
        console.error('❌ Content script not available after injection:', retryErr);
        await backgroundDataController.saveData(url, {
          processing: { pageAssets: { isExtracting: false, error: 'Content script not available' } }
        });
        sendResponse({
          success: false,
          error: 'Content script not available. Please refresh the page and try again.'
        });
        return;
      }
    }

    if (response?.success && response?.assets) {
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { pageAssets: response.assets },
        processing: { pageAssets: { isExtracting: false, error: null } }
      });

      console.log('🎨 Save result:', saveResult);

      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true);
      console.log('🎨 Verified page assets after save:', {
        hasAssets: !!verifyData?.analysis?.pageAssets,
        fontCount: verifyData?.analysis?.pageAssets?.fonts?.length || 0,
        imageCount: verifyData?.analysis?.pageAssets?.images?.length || 0,
        svgCount: verifyData?.analysis?.pageAssets?.svgs?.length || 0
      });

      console.log('✅ Page assets extraction completed successfully');
      sendResponse({ success: true, assets: response.assets });
    } else {
      console.error('❌ Page assets extraction failed:', response?.error);
      await backgroundDataController.saveData(url, {
        processing: { pageAssets: { isExtracting: false, error: response?.error || 'Unknown error' } }
      });
      sendResponse({
        success: false,
        error: response?.error || 'Failed to extract page assets'
      });
    }

  } catch (error) {
    console.error('❌ Error in page assets extraction process:', error);

    try {
      await backgroundDataController.saveData(url, {
        processing: {
          pageAssets: { isExtracting: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update page assets processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get page assets status for a URL
 */
export async function getPageAssetsStatus(url: string): Promise<{
  assets: any | null;
  isExtracting: boolean;
  error: string | null
}> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      assets: tabData?.analysis?.pageAssets || null,
      isExtracting: tabData?.processing?.pageAssets?.isExtracting || false,
      error: tabData?.processing?.pageAssets?.error || null
    };
  } catch (error) {
    console.error('❌ Error getting page assets status:', error);
    return {
      assets: null,
      isExtracting: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
