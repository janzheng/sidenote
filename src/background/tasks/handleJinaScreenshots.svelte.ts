import type { TabData } from '../../types/tabData';
import type { ScreenshotInfo } from '../../types/pageAssets';
import { backgroundDataController } from '../index';
import { JinaService } from '../../lib/services/jinaService.svelte';

/**
 * Handle Jina pageshot generation request for a specific URL
 */
export async function handleJinaPageshot(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('📸 Starting Jina pageshot for URL:', url);

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

    // Log current pageAssets status before update
    console.log('📸 Current pageAssets status:', tabData.processing?.pageAssets);
    
    // ✅ NEW: Only specify the fields we want to update!
    await backgroundDataController.saveData(url, {
      processing: { 
        pageAssets: { isExtracting: true, error: null }
      }
    });

    // Use the JinaService to generate pageshot
    const pageshotResult = await JinaService.generatePageshot(url);
    
    if (pageshotResult.success && pageshotResult.screenshots) {
      // Get existing pageAssets and merge with new screenshots
      const existingPageAssets = tabData.analysis?.pageAssets || { fonts: [], images: [], svgs: [], stats: { totalFonts: 0, totalImages: 0, totalSvgs: 0, uniqueFontFamilies: 0, imageFormats: {}, svgContexts: {} } };
      const existingScreenshots = existingPageAssets.screenshots || {};
      
      const updatedPageAssets = {
        ...existingPageAssets,
        screenshots: {
          ...existingScreenshots,
          pageshot: pageshotResult.screenshots.pageshot,
          capturedAt: pageshotResult.screenshots.capturedAt
        }
      };

      // ✅ NEW: Only specify the fields we want to update!
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { 
          pageAssets: updatedPageAssets
        },
        processing: { 
          pageAssets: { isExtracting: false, error: null }
        }
      });
      
      console.log('📸 Save result:', saveResult);
      
      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
      console.log('📸 Verified pageshot after save:', verifyData?.analysis?.pageAssets?.screenshots?.pageshot?.substring(0, 50) + '...');

      console.log('✅ Pageshot generated successfully');
      sendResponse({ 
        success: true, 
        screenshots: pageshotResult.screenshots
      });
    } else {
      // ✅ NEW: Only specify the fields we want to update!
      await backgroundDataController.saveData(url, {
        processing: { 
          pageAssets: { isExtracting: false, error: pageshotResult.error || 'Unknown error' }
        }
      });
      
      console.error('❌ Pageshot generation failed:', pageshotResult.error);
      sendResponse({ 
        success: false, 
        error: pageshotResult.error || 'Failed to generate pageshot' 
      });
    }

  } catch (error) {
    console.error('❌ Error in pageshot generation process:', error);
    
    // ✅ NEW: Only specify the fields we want to update!
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          pageAssets: { isExtracting: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update pageshot processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle Jina screenshot generation request for a specific URL
 */
export async function handleJinaScreenshot(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('📷 Starting Jina screenshot for URL:', url);

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

    // Log current pageAssets status before update
    console.log('📷 Current pageAssets status:', tabData.processing?.pageAssets);
    
    // ✅ NEW: Only specify the fields we want to update!
    await backgroundDataController.saveData(url, {
      processing: { 
        pageAssets: { isExtracting: true, error: null }
      }
    });

    // Use the JinaService to generate screenshot
    const screenshotResult = await JinaService.generateScreenshot(url);
    
    if (screenshotResult.success && screenshotResult.screenshots) {
      // Get existing pageAssets and merge with new screenshots
      const existingPageAssets = tabData.analysis?.pageAssets || { fonts: [], images: [], svgs: [], stats: { totalFonts: 0, totalImages: 0, totalSvgs: 0, uniqueFontFamilies: 0, imageFormats: {}, svgContexts: {} } };
      const existingScreenshots = existingPageAssets.screenshots || {};
      
      const updatedPageAssets = {
        ...existingPageAssets,
        screenshots: {
          ...existingScreenshots,
          screenshot: screenshotResult.screenshots.screenshot,
          capturedAt: screenshotResult.screenshots.capturedAt
        }
      };

      // ✅ NEW: Only specify the fields we want to update!
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { 
          pageAssets: updatedPageAssets
        },
        processing: { 
          pageAssets: { isExtracting: false, error: null }
        }
      });
      
      console.log('📷 Save result:', saveResult);
      
      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true);
      console.log('📷 Verified screenshot after save:', verifyData?.analysis?.pageAssets?.screenshots?.screenshot?.substring(0, 50) + '...');

      console.log('✅ Screenshot generated successfully');
      sendResponse({ 
        success: true, 
        screenshots: screenshotResult.screenshots
      });
    } else {
      // ✅ NEW: Only specify the fields we want to update!
      await backgroundDataController.saveData(url, {
        processing: { 
          pageAssets: { isExtracting: false, error: screenshotResult.error || 'Unknown error' }
        }
      });
      
      console.error('❌ Screenshot generation failed:', screenshotResult.error);
      sendResponse({ 
        success: false, 
        error: screenshotResult.error || 'Failed to generate screenshot' 
      });
    }

  } catch (error) {
    console.error('❌ Error in screenshot generation process:', error);
    
    // ✅ NEW: Only specify the fields we want to update!
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          pageAssets: { isExtracting: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update screenshot processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get screenshot status for a URL
 */
export async function getScreenshotStatus(url: string): Promise<{ 
  screenshots: ScreenshotInfo | null; 
  isGenerating: boolean; 
  error: string | null 
}> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      screenshots: tabData?.analysis?.pageAssets?.screenshots || null,
      isGenerating: tabData?.processing?.pageAssets?.isExtracting || false,
      error: tabData?.processing?.pageAssets?.error || null
    };
  } catch (error) {
    console.error('❌ Error getting screenshot status:', error);
    return { 
      screenshots: null, 
      isGenerating: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 