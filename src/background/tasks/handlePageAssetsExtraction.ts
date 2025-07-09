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

    // Log current page assets status before update
    console.log('🎨 Current page assets status:', tabData.processing?.pageAssets);
    
    // Update processing status to indicate we're extracting
    await backgroundDataController.saveData(url, {
      processing: { 
        summary: tabData.processing?.summary || { isStreaming: false, error: null },
        citations: tabData.processing?.citations || { isGenerating: false, error: null },
        researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
        chat: tabData.processing?.chat || { isGenerating: false, error: null },
        threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
        pageAssets: { isExtracting: true, error: null }
      }
    });

    // Send message to content script to extract page assets
    chrome.tabs.query({ url: url }, async (tabs) => {
      if (tabs.length === 0) {
        console.error('❌ No tabs found for URL:', url);
        
        // Update processing status to error
        await backgroundDataController.saveData(url, {
          processing: { 
            summary: tabData.processing?.summary || { isStreaming: false, error: null },
            citations: tabData.processing?.citations || { isGenerating: false, error: null },
            researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
            chat: tabData.processing?.chat || { isGenerating: false, error: null },
            threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
            pageAssets: { isExtracting: false, error: 'No active tab found for this URL' }
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
        console.error('❌ Tab ID not found');
        
        // Update processing status to error
        await backgroundDataController.saveData(url, {
          processing: { 
            summary: tabData.processing?.summary || { isStreaming: false, error: null },
            citations: tabData.processing?.citations || { isGenerating: false, error: null },
            researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
            chat: tabData.processing?.chat || { isGenerating: false, error: null },
            threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
            pageAssets: { isExtracting: false, error: 'Tab ID not found' }
          }
        });
        
        sendResponse({ 
          success: false, 
          error: 'Tab ID not found' 
        });
        return;
      }

      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { action: 'extractPageAssets' }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Content script not available:', chrome.runtime.lastError.message);
          
          // Update processing status to error
          await backgroundDataController.saveData(url, {
            processing: { 
              summary: tabData.processing?.summary || { isStreaming: false, error: null },
              citations: tabData.processing?.citations || { isGenerating: false, error: null },
              researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
              chat: tabData.processing?.chat || { isGenerating: false, error: null },
              threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
              pageAssets: { isExtracting: false, error: 'Content script not available' }
            }
          });
          
          sendResponse({ 
            success: false, 
            error: 'Content script not available. Please refresh the page and try again.' 
          });
          return;
        }

        if (response?.success && response?.assets) {
          // Update with successful extraction
          const saveResult = await backgroundDataController.saveData(url, {
            analysis: { 
              summary: tabData.analysis?.summary || null,
              citations: tabData.analysis?.citations || null,
              researchPaper: tabData.analysis?.researchPaper || null,
              contentStructure: tabData.analysis?.contentStructure || null,
              chatMessages: tabData.analysis?.chatMessages || null,
              threadgirlResults: tabData.analysis?.threadgirlResults || null,
              pageAssets: response.assets
            },
            processing: { 
              summary: tabData.processing?.summary || { isStreaming: false, error: null },
              citations: tabData.processing?.citations || { isGenerating: false, error: null },
              researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
              chat: tabData.processing?.chat || { isGenerating: false, error: null },
              threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
              pageAssets: { isExtracting: false, error: null }
            }
          });
          
          console.log('🎨 Save result:', saveResult);
          
          // Verify the save by loading the data again
          const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
          console.log('🎨 Verified page assets after save:', {
            hasAssets: !!verifyData?.analysis?.pageAssets,
            fontCount: verifyData?.analysis?.pageAssets?.fonts?.length || 0,
            imageCount: verifyData?.analysis?.pageAssets?.images?.length || 0,
            svgCount: verifyData?.analysis?.pageAssets?.svgs?.length || 0
          });

          console.log('✅ Page assets extraction completed successfully');
          sendResponse({ 
            success: true, 
            assets: response.assets
          });
        } else {
          console.error('❌ Page assets extraction failed:', response?.error);
          
          // Update processing status to error
          await backgroundDataController.saveData(url, {
            processing: { 
              summary: tabData.processing?.summary || { isStreaming: false, error: null },
              citations: tabData.processing?.citations || { isGenerating: false, error: null },
              researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
              chat: tabData.processing?.chat || { isGenerating: false, error: null },
              threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
              pageAssets: { isExtracting: false, error: response?.error || 'Unknown error' }
            }
          });
          
          sendResponse({ 
            success: false, 
            error: response?.error || 'Failed to extract page assets' 
          });
        }
      });
    });

  } catch (error) {
    console.error('❌ Error in page assets extraction process:', error);
    
    // Update processing status to error
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          summary: { isStreaming: false, error: null },
          citations: { isGenerating: false, error: null },
          researchPaper: { isExtracting: false, progress: '', error: null },
          chat: { isGenerating: false, error: null },
          threadgirl: { isProcessing: false, error: null },
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