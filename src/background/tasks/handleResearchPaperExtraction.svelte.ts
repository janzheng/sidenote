import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';
import { ResearchPaperService } from '../../lib/services/researchPaperService.svelte';

/**
 * Handle research paper extraction request for a specific URL
 */
export async function handleResearchPaperExtraction(
  url: string, 
  userBackground: string | undefined, 
  sendResponse: (response: any) => void
) {
  try {
    console.log('🔬 Starting research paper extraction for URL:', url);

    // Load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      });
      return;
    }

    // Update processing status to indicate we're extracting
    await backgroundDataController.saveData(url, {
      processing: { 
        researchPaper: { 
          isExtracting: true, 
          progress: 'Starting comprehensive analysis...', 
          error: null 
        }
      }
    }); 

    // Use the ResearchPaperService to extract research paper (comprehensive analysis)
    const extractionResult = await ResearchPaperService.extractResearchPaper(
      tabData, 
      userBackground, 
      false // comprehensive analysis
    );
    
    if (extractionResult.success && extractionResult.analysis) {
      // Update with successful extraction
      await backgroundDataController.saveData(url, {
        analysis: { 
          researchPaper: extractionResult.analysis
        },
        processing: { 
          researchPaper: { 
            isExtracting: false, 
            progress: 'Comprehensive analysis complete!', 
            error: null 
          }
        }
      });

      console.log('✅ Research paper extraction successful');
      sendResponse({ 
        success: true, 
        analysis: extractionResult.analysis
      });
    } else {
      // Update processing status to error
      await backgroundDataController.saveData(url, {
        processing: { 
          researchPaper: { 
            isExtracting: false, 
            progress: '', 
            error: extractionResult.error || 'Unknown error' 
          }
        }
      });
      
      console.error('❌ Research paper extraction failed:', extractionResult.error);
      sendResponse({ 
        success: false, 
        error: extractionResult.error || 'Failed to extract research paper' 
      });
    }

  } catch (error) {
    console.error('❌ Error in research paper extraction process:', error);
    
    // Update processing status to error
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          researchPaper: { 
            isExtracting: false, 
            progress: '', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update research paper processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle quick research paper extraction request for a specific URL
 */
export async function handleQuickResearchPaperExtraction(
  url: string, 
  userBackground: string | undefined, 
  sendResponse: (response: any) => void
) {
  try {
    console.log('⚡ Starting quick research paper extraction for URL:', url);

    // Load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      });
      return;
    }

    // Update processing status to indicate we're extracting
    await backgroundDataController.saveData(url, {
      processing: { 
        researchPaper: { 
          isExtracting: true, 
          progress: 'Starting quick analysis...', 
          error: null 
        }
      }
    }); 

    // Use the ResearchPaperService to extract research paper (quick analysis)
    const extractionResult = await ResearchPaperService.extractResearchPaper(
      tabData, 
      userBackground, 
      true // quick analysis
    );
    
    if (extractionResult.success && extractionResult.analysis) {
      // Update with successful extraction
      await backgroundDataController.saveData(url, {
        analysis: { 
          researchPaper: extractionResult.analysis
        },
        processing: { 
          researchPaper: { 
            isExtracting: false, 
            progress: 'Quick analysis complete!', 
            error: null 
          }
        }
      });

      console.log('✅ Quick research paper extraction successful');
      sendResponse({ 
        success: true, 
        analysis: extractionResult.analysis
      });
    } else {
      // Update processing status to error
      await backgroundDataController.saveData(url, {
        processing: { 
          researchPaper: { 
            isExtracting: false, 
            progress: '', 
            error: extractionResult.error || 'Unknown error' 
          }
        }
      });
      
      console.error('❌ Quick research paper extraction failed:', extractionResult.error);
      sendResponse({ 
        success: false, 
        error: extractionResult.error || 'Failed to extract research paper' 
      });
    }

  } catch (error) {
    console.error('❌ Error in quick research paper extraction process:', error);
    
    // Update processing status to error
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          researchPaper: { 
            isExtracting: false, 
            progress: '', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update research paper processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle single section extraction for lazy loading
 */
export async function handleSingleSectionExtraction(
  url: string,
  sectionName: string,
  userBackground: string | undefined,
  sendResponse: (response: any) => void
) {
  try {
    console.log(`🔍 Starting single section extraction for: ${sectionName} on URL: ${url}`);

    // Load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      });
      return;
    }

    // Extract the single section
    const extractionResult = await ResearchPaperService.extractSingleSectionOnDemand(
      tabData,
      sectionName,
      userBackground
    );

    if (extractionResult.success && extractionResult.section) {
      // Update the existing research paper analysis with the new section
      const existingAnalysis = tabData.analysis?.researchPaper;
      if (existingAnalysis && existingAnalysis.sections) {
        existingAnalysis.sections[sectionName] = extractionResult.section;
        
        // Save the updated analysis
        await backgroundDataController.saveData(url, {
          analysis: { 
            researchPaper: existingAnalysis
          }
        });

        console.log(`✅ Single section extraction successful: ${sectionName}`);
        sendResponse({ 
          success: true, 
          sectionName: sectionName,
          section: extractionResult.section
        });
      } else {
        console.error('❌ No existing research paper analysis found');
        sendResponse({ 
          success: false, 
          error: 'No existing research paper analysis found. Please run analysis first.' 
        });
      }
    } else {
      console.error(`❌ Single section extraction failed for ${sectionName}:`, extractionResult.error);
      sendResponse({ 
        success: false, 
        error: extractionResult.error || `Failed to extract section: ${sectionName}` 
      });
    }

  } catch (error) {
    console.error(`❌ Error in single section extraction process for ${sectionName}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get research paper extraction status for a URL
 */
export async function getResearchPaperStatus(url: string): Promise<{ 
  analysis: any | null; 
  isExtracting: boolean; 
  progress: string; 
  error: string | null 
}> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      analysis: tabData?.analysis?.researchPaper || null,
      isExtracting: tabData?.processing?.researchPaper?.isExtracting || false,
      progress: tabData?.processing?.researchPaper?.progress || '',
      error: tabData?.processing?.researchPaper?.error || null
    };
  } catch (error) {
    console.error('❌ Error getting research paper status:', error);
    return { 
      analysis: null, 
      isExtracting: false, 
      progress: '', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 