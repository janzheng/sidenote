import { backgroundDataController } from '../index';

/**
 * Handle PDF extraction request for a specific URL
 */
export async function handlePDFExtraction(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('📄 Starting PDF extraction for URL:', url);

    // First, check if we already have data for this URL
    const existingData = await backgroundDataController.loadData(url);
    
    // Check if this URL is a PDF
    const isPDFUrl = (url: string): boolean => {
      const lowerUrl = url.toLowerCase();
      return lowerUrl.includes('.pdf') || 
             lowerUrl.includes('arxiv.org/pdf/') ||
             (lowerUrl.includes('biorxiv.org') && lowerUrl.includes('.full.pdf')) ||
             (lowerUrl.includes('medrxiv.org') && lowerUrl.includes('.full.pdf'));
    };

    if (!isPDFUrl(url)) {
      console.error('❌ URL is not a PDF:', url);
      sendResponse({ 
        success: false, 
        error: 'This URL does not appear to be a PDF document.' 
      });
      return;
    }

    // Get the active tab to send message to content script
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      console.error('❌ No active tab found');
      sendResponse({ 
        success: false, 
        error: 'No active tab found for PDF extraction.' 
      });
      return;
    }

    const tabId = tabs[0].id;
    if (!tabId) {
      console.error('❌ Active tab has no ID');
      sendResponse({ 
        success: false, 
        error: 'Active tab ID not available.' 
      });
      return;
    }

    // Send message to content script to extract PDF content
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Content script communication failed:', chrome.runtime.lastError);
        sendResponse({ 
          success: false, 
          error: 'Failed to communicate with content script for PDF extraction.' 
        });
        return;
      }

      if (response?.success) {
        console.log('✅ PDF extraction successful via content script');
        
        // Load the full TabData from data controller to include all statuses
        const fullTabData = await backgroundDataController.loadData(url, true);
        
        if (fullTabData) {
          sendResponse({ success: true, data: fullTabData });
        } else {
          sendResponse({ success: true, data: response.content });
        }
      } else {
        console.error('❌ PDF extraction failed via content script:', response?.error);
        sendResponse({ 
          success: false, 
          error: response?.error || 'PDF extraction failed' 
        });
      }
    });

  } catch (error) {
    console.error('❌ Handle PDF extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get PDF extraction status for a specific URL
 */
export async function getPDFExtractionStatus(url: string): Promise<{
  isExtracted: boolean;
  isPDF: boolean;
  hasContent: boolean;
  error?: string;
}> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    
    if (!tabData) {
      return {
        isExtracted: false,
        isPDF: false,
        hasContent: false
      };
    }

    const isPDF = (tabData.content?.metadata as any)?.contentType === 'pdf' || 
                  (tabData.content?.metadata as any)?.isPDF === true;
    
    return {
      isExtracted: !!tabData.content,
      isPDF: isPDF,
      hasContent: !!tabData.content?.text && tabData.content.text.length > 0
    };

  } catch (error) {
    console.error('❌ Error getting PDF extraction status:', error);
    return {
      isExtracted: false,
      isPDF: false,
      hasContent: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 