import type { TabData } from '../../types/tabData';
import type { ThreadgirlResult } from '../../types/threadgirlResult';
import { backgroundDataController } from '../index';
import { ThreadgirlService } from '../../lib/services/threadgirlService.svelte';

/**
 * Handle Threadgirl processing request for a specific URL
 */
export async function handleThreadgirlProcessing(
  url: string, 
  prompt: string, 
  model: string, 
  sendResponse: (response: any) => void
) {
  try {
    console.log('🤖 Starting Threadgirl processing for URL:', url);

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

    // Check if we have content to process
    if (!tabData.content?.text || tabData.content.text.trim().length === 0) {
      console.error('❌ No text content found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No text content available to process.' 
      });
      return;
    }

    // Log current processing status before update
    console.log('🤖 Current Threadgirl status:', tabData.processing?.threadgirl);
    
    await backgroundDataController.saveData(url, {
      processing: { 
        threadgirl: { isProcessing: true, error: null }
      }
    });

    // Use the ThreadgirlService to process content
    console.log('🤖 Using ThreadGirl service');
    console.log(`🤖 Background received model parameter: "${model}"`);
    console.log(`🤖 Background model type: ${typeof model}`);
    
    if (!model || typeof model !== 'string' || model.trim() === '') {
      console.error('❌ No valid model provided to background script');
      sendResponse({ 
        success: false, 
        error: 'No valid model specified for processing' 
      });
      return;
    }
    
    const localResult = await ThreadgirlService.processContent(tabData, prompt, model);
    
    if (!localResult.success || !localResult.result) {
      await backgroundDataController.saveData(url, {
        processing: { 
          threadgirl: { isProcessing: false, error: localResult.error || 'Unknown error' }
        }
      });
      
      console.error('❌ Threadgirl processing failed:', localResult.error);
      sendResponse({ 
        success: false, 
        error: localResult.error || 'Failed to process content' 
      });
      return;
    }

    const threadgirlResult = localResult.result;

    // Get existing results and add the new one
    const existingResults = tabData.analysis?.threadgirlResults || [];
    const updatedResults = [...existingResults, threadgirlResult];
    
    // ✅ NEW: Only specify the fields we want to update!
    const saveResult = await backgroundDataController.saveData(url, {
      analysis: { 
        threadgirlResults: updatedResults
      },
      processing: { 
        threadgirl: { isProcessing: false, error: null }
      }
    });
    
    console.log('🤖 Save result:', saveResult);
    
    // Verify the save by loading the data again
    const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
    console.log('🤖 Verified Threadgirl results after save:', {
      count: verifyData?.analysis?.threadgirlResults?.length || 0,
      latestId: verifyData?.analysis?.threadgirlResults?.[verifyData.analysis.threadgirlResults.length - 1]?.id
    });

    console.log('✅ Threadgirl processing completed successfully');
    sendResponse({ 
      success: true, 
      result: threadgirlResult
    });

  } catch (error) {
    console.error('❌ Error in Threadgirl processing:', error);
    
    // ✅ NEW: Only specify the fields we want to update!
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          threadgirl: { isProcessing: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update Threadgirl processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get Threadgirl status for a URL
 */
export async function getThreadgirlStatus(url: string): Promise<{ 
  results: any[] | null; 
  isProcessing: boolean; 
  error: string | null 
}> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      results: tabData?.analysis?.threadgirlResults || null,
      isProcessing: tabData?.processing?.threadgirl?.isProcessing || false,
      error: tabData?.processing?.threadgirl?.error || null
    };
  } catch (error) {
    console.error('❌ Error getting Threadgirl status:', error);
    return { 
      results: null, 
      isProcessing: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 