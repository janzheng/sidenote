import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';
import { SummaryService } from '../../lib/services/summaryService';

/**
 * Handle summary generation request for a specific URL
 */
export async function handleSummaryGeneration(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🤖 Starting summary generation for URL:', url);

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

    // Log current summary status before update
    console.log('🤖 Current summary status:', tabData.processing?.summary);
    
    // Update processing status to indicate we're generating
    await backgroundDataController.saveData(url, {
      processing: { 
        summary: { isStreaming: true, error: null },
        citations: tabData.processing?.citations || { isGenerating: false, error: null },
        researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
        chat: tabData.processing?.chat || { isGenerating: false, error: null },
        threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
        pageAssets: tabData.processing?.pageAssets || { isExtracting: false, error: null }
      }
    });

    // Use the SummaryService to generate summary
    const summaryResult = await SummaryService.generateSummary(tabData);
    
    if (summaryResult.success && summaryResult.summary) {
      // Update with successful summary
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { 
          summary: summaryResult.summary,
          citations: tabData.analysis?.citations || null,
          researchPaper: tabData.analysis?.researchPaper || null,
          contentStructure: tabData.analysis?.contentStructure || null,
          chatMessages: tabData.analysis?.chatMessages || null,
          threadgirlResults: tabData.analysis?.threadgirlResults || null,
          pageAssets: tabData.analysis?.pageAssets || null
        },
        processing: { 
          summary: { isStreaming: false, error: null },
          citations: tabData.processing?.citations || { isGenerating: false, error: null },
          researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
          chat: tabData.processing?.chat || { isGenerating: false, error: null },
          threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
          pageAssets: tabData.processing?.pageAssets || { isExtracting: false, error: null }
        }
      });
      
      console.log('🤖 Save result:', saveResult);
      
      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
      console.log('🤖 Verified summary after save:', verifyData?.analysis?.summary?.substring(0, 100) + '...');

      console.log('✅ Summary generated successfully');
      sendResponse({ 
        success: true, 
        summary: summaryResult.summary,
        summaryId: summaryResult.summaryId 
      });
    } else {
      // Update processing status to error
      await backgroundDataController.saveData(url, {
        processing: { 
          summary: { isStreaming: false, error: summaryResult.error || 'Unknown error' },
          citations: tabData.processing?.citations || { isGenerating: false, error: null },
          researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
          chat: tabData.processing?.chat || { isGenerating: false, error: null },
          threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
          pageAssets: tabData.processing?.pageAssets || { isExtracting: false, error: null }
        }
      });
      
      console.error('❌ Summary generation failed:', summaryResult.error);
      sendResponse({ 
        success: false, 
        error: summaryResult.error || 'Failed to generate summary' 
      });
    }

  } catch (error) {
    console.error('❌ Error in summary generation process:', error);
    
    // Update processing status to error
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          summary: { isStreaming: false, error: error instanceof Error ? error.message : 'Unknown error' },
          citations: { isGenerating: false, error: null },
          researchPaper: { isExtracting: false, progress: '', error: null },
          chat: { isGenerating: false, error: null },
          threadgirl: { isProcessing: false, error: null },
          pageAssets: { isExtracting: false, error: null }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update summary processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get summary status for a URL
 */
export async function getSummaryStatus(url: string): Promise<{ summary: string | null; isGenerating: boolean; error: string | null }> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      summary: tabData?.analysis?.summary || null,
      isGenerating: tabData?.processing?.summary?.isStreaming || false,
      error: tabData?.processing?.summary?.error || null
    };
  } catch (error) {
    console.error('❌ Error getting summary status:', error);
    return { summary: null, isGenerating: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
} 