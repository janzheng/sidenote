import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';
import { parseContentFromMarkdown } from '../../lib/services/parseContent.svelte';

/**
 * Handle content structure parsing request for a specific URL
 */
export async function handleContentStructureParsing(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🔍 Starting content structure parsing for URL:', url);

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

    // Check if we already have a content structure
    if (tabData.analysis?.contentStructure) {
      console.log('✅ Content structure already exists for URL:', url);
      sendResponse({ 
        success: true, 
        contentStructure: tabData.analysis.contentStructure,
        cached: true
      });
      return;
    }

    // Check if we have content to parse
    if (!tabData.content?.html && !tabData.content?.markdown && !tabData.content?.text) {
      console.error('❌ No parseable content found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No HTML, markdown, or text content available for parsing.' 
      });
      return;
    }

    console.log('🔍 Parsing content structure...');
    
    // Parse using markdown parser (background-safe, no DOM APIs)
    let parseResult;
    
    // Try markdown first, then text, then HTML as text
    if (tabData.content.markdown) {
      parseResult = parseContentFromMarkdown(tabData.content.markdown);
    } else if (tabData.content.text) {
      parseResult = parseContentFromMarkdown(tabData.content.text);
    } else if (tabData.content.html) {
      // Convert HTML to text by stripping tags (basic approach for background script)
      const htmlAsText = tabData.content.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      parseResult = parseContentFromMarkdown(htmlAsText);
    } else {
      console.error('❌ No parseable content found');
      sendResponse({ 
        success: false, 
        error: 'No parseable content available' 
      });
      return;
    }

    if (!parseResult.contentStructure || parseResult.error) {
      console.error('❌ Content structure parsing failed:', parseResult.error);
      sendResponse({ 
        success: false, 
        error: parseResult.error || 'Failed to parse content structure' 
      });
      return;
    }

    // Create a minimal ContentGraph structure that satisfies the type requirements
    const contentGraph = {
      root: {
        id: 'root',
        type: 'root' as const,
        title: 'Document Root',
        content: '',
        children: parseResult.contentStructure.root.children,
        order: 0
      },
      nodes: new Map<string, any>(),
      flatNodes: [],
      headerLevels: new Map<number, any[]>(),
      stats: {
        ...parseResult.contentStructure.stats,
        wordCount: parseResult.contentStructure.stats.totalNodes * 10 // rough estimate
      }
    };

    // Save the parsed content structure to the data controller
    const saveResult = await backgroundDataController.saveData(url, {
      analysis: { 
        summary: tabData.analysis?.summary || null,
        citations: tabData.analysis?.citations || null,
        researchPaper: tabData.analysis?.researchPaper || null,
        contentStructure: contentGraph
      }
    });
    
    console.log('🔍 Content structure save result:', saveResult);
    
    // Verify the save by loading the data again
    const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
    console.log('🔍 Verified content structure after save:', {
      hasStructure: !!verifyData?.analysis?.contentStructure,
      nodeCount: verifyData?.analysis?.contentStructure?.stats?.totalNodes || 0,
      headerCount: verifyData?.analysis?.contentStructure?.stats?.headerCount || 0
    });

    console.log('✅ Content structure parsed and saved successfully');
    sendResponse({ 
      success: true, 
      contentStructure: contentGraph,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error in content structure parsing process:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get content structure status for a URL
 */
export async function getContentStructureStatus(url: string): Promise<{ 
  contentStructure: any | null; 
  hasStructure: boolean; 
  error: string | null 
}> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      contentStructure: tabData?.analysis?.contentStructure || null,
      hasStructure: !!tabData?.analysis?.contentStructure,
      error: null
    };
  } catch (error) {
    console.error('❌ Error getting content structure status:', error);
    return { 
      contentStructure: null, 
      hasStructure: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 