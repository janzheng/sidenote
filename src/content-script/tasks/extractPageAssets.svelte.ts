import { PageAssetsService } from '../../lib/services/pageAssetsService';
import type { PageAssetsExtractionResult } from '../../types/pageAssets';
import { contentDataController } from '../../lib/services/dataController.svelte';
import { cleanUrl } from './extractMetadata.svelte';

/**
 * Extract page assets from the current page and save to data controller
 */
export async function extractPageAssets(): Promise<PageAssetsExtractionResult> {
  try {
    const currentUrl = window.location.href;
    const cleanedUrl = cleanUrl(currentUrl);
    
    console.log('🎨 Extracting page assets for:', currentUrl);
    if (currentUrl !== cleanedUrl) {
      console.log('🎨 Cleaned URL:', cleanedUrl);
    }
    
    // Extract page assets using the service
    const result = await PageAssetsService.extractPageAssets(
      document.documentElement.outerHTML,
      cleanedUrl
    );
    
    if (result.success && result.assets) {
      // Load existing data to preserve other fields
      const existingData = await contentDataController.loadData(cleanedUrl);
      
      // Save to data controller - this will merge with existing data
      const saveData = {
        analysis: {
          summary: existingData?.analysis?.summary || null,
          citations: existingData?.analysis?.citations || null,
          researchPaper: existingData?.analysis?.researchPaper || null,
          contentStructure: existingData?.analysis?.contentStructure || null,
          chatMessages: existingData?.analysis?.chatMessages || null,
          threadgirlResults: existingData?.analysis?.threadgirlResults || null,
          pageAssets: result.assets
        }
      };
      
      const saveSuccess = await contentDataController.saveData(cleanedUrl, saveData);
      
      if (!saveSuccess) {
        console.warn('⚠️ Failed to save page assets to data controller, but extraction succeeded');
      }
      
      console.log('🎨 Page assets extracted and saved:', {
        url: cleanedUrl,
        fonts: result.assets.fonts.length,
        images: result.assets.images.length,
        svgs: result.assets.svgs.length,
        saved: saveSuccess
      });
    }
    
    return result;
  } catch (error) {
    console.error('🎨 Page assets extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Page assets extraction failed'
    };
  }
} 