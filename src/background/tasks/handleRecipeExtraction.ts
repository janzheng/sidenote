import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';
import { RecipeService } from '../../lib/services/recipeService';

/**
 * Handle recipe extraction request for a specific URL
 */
export async function handleRecipeExtraction(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🍳 Starting recipe extraction for URL:', url);

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

    // Log current recipe status before update
    console.log('🍳 Current recipe status:', tabData.processing?.recipe);
    
    // Update processing status to indicate we're extracting
    await backgroundDataController.saveData(url, {
      processing: { 
        summary: tabData.processing?.summary || { isStreaming: false, error: null },
        citations: tabData.processing?.citations || { isGenerating: false, error: null },
        researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
        chat: tabData.processing?.chat || { isGenerating: false, error: null },
        threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
        pageAssets: tabData.processing?.pageAssets || { isExtracting: false, error: null },
        recipe: { isExtracting: true, error: null }
      }
    });

    // Use the RecipeService to extract recipe
    const recipeResult = await RecipeService.extractRecipe(tabData);
    
    if (recipeResult.success && recipeResult.recipe) {
      // Update with successful recipe extraction
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { 
          summary: tabData.analysis?.summary || null,
          citations: tabData.analysis?.citations || null,
          researchPaper: tabData.analysis?.researchPaper || null,
          contentStructure: tabData.analysis?.contentStructure || null,
          chatMessages: tabData.analysis?.chatMessages || null,
          threadgirlResults: tabData.analysis?.threadgirlResults || null,
          pageAssets: tabData.analysis?.pageAssets || null,
          recipe: recipeResult.recipe
        },
        processing: { 
          summary: tabData.processing?.summary || { isStreaming: false, error: null },
          citations: tabData.processing?.citations || { isGenerating: false, error: null },
          researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
          chat: tabData.processing?.chat || { isGenerating: false, error: null },
          threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
          pageAssets: tabData.processing?.pageAssets || { isExtracting: false, error: null },
          recipe: { isExtracting: false, error: null }
        }
      });
      
      console.log('🍳 Save result:', saveResult);
      
      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
      console.log('🍳 Verified recipe after save:', verifyData?.analysis?.recipe?.title);

      console.log('✅ Recipe extracted successfully');
      sendResponse({ 
        success: true, 
        recipe: recipeResult.recipe,
        recipeId: recipeResult.recipeId 
      });
    } else {
      // Update processing status to error
      await backgroundDataController.saveData(url, {
        processing: { 
          summary: tabData.processing?.summary || { isStreaming: false, error: null },
          citations: tabData.processing?.citations || { isGenerating: false, error: null },
          researchPaper: tabData.processing?.researchPaper || { isExtracting: false, progress: '', error: null },
          chat: tabData.processing?.chat || { isGenerating: false, error: null },
          threadgirl: tabData.processing?.threadgirl || { isProcessing: false, error: null },
          pageAssets: tabData.processing?.pageAssets || { isExtracting: false, error: null },
          recipe: { isExtracting: false, error: recipeResult.error || 'Unknown error' }
        }
      });
      
      console.error('❌ Recipe extraction failed:', recipeResult.error);
      sendResponse({ 
        success: false, 
        error: recipeResult.error || 'Failed to extract recipe' 
      });
    }

  } catch (error) {
    console.error('❌ Error in recipe extraction process:', error);
    
    // Update processing status to error
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          summary: { isStreaming: false, error: null },
          citations: { isGenerating: false, error: null },
          researchPaper: { isExtracting: false, progress: '', error: null },
          chat: { isGenerating: false, error: null },
          threadgirl: { isProcessing: false, error: null },
          pageAssets: { isExtracting: false, error: null },
          recipe: { isExtracting: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update recipe processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get recipe status for a URL
 */
export async function getRecipeStatus(url: string): Promise<{ recipe: any | null; isExtracting: boolean; error: string | null }> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      recipe: tabData?.analysis?.recipe || null,
      isExtracting: tabData?.processing?.recipe?.isExtracting || false,
      error: tabData?.processing?.recipe?.error || null
    };
  } catch (error) {
    console.error('❌ Error getting recipe status:', error);
    return { recipe: null, isExtracting: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
} 