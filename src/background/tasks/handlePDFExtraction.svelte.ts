import { backgroundDataController } from '../index';
import { PDFCitationService } from '../../lib/services/pdfCitationService.svelte';
import { CitationService } from '../../lib/services/citationService.svelte';

/**
 * Handle PDF extraction request for a specific URL
 */
export async function handlePDFExtraction(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('📄 Starting PDF extraction for URL:', url);

    // Check if this URL is a PDF
    const isPDFUrl = (u: string): boolean => {
      const lowerUrl = u.toLowerCase();
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
    if (tabs.length === 0 || !tabs[0].id) {
      console.error('❌ No active tab found');
      sendResponse({
        success: false,
        error: 'No active tab found for PDF extraction.'
      });
      return;
    }

    const tabId = tabs[0].id;

    // Send message to content script to extract PDF content
    let response: any;
    try {
      response = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
    } catch (err) {
      console.error('❌ Content script communication failed:', err);
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
      sendResponse({ success: true, data: fullTabData || response.content });
    } else {
      console.error('❌ PDF extraction failed via content script:', response?.error);
      sendResponse({
        success: false,
        error: response?.error || 'PDF extraction failed'
      });
    }

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
      return { isExtracted: false, isPDF: false, hasContent: false };
    }

    const isPDF = (tabData.content?.metadata as any)?.contentType === 'pdf' ||
                  (tabData.content?.metadata as any)?.isPDF === true;

    return {
      isExtracted: !!tabData.content,
      isPDF,
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

/**
 * Generate citations for any URL (PDF or regular content)
 */
export async function generateCitations(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('📚 Generating citations for URL:', url);

    const tabData = await backgroundDataController.loadData(url);

    if (!tabData || !tabData.content) {
      console.error('❌ No content found for URL:', url);
      sendResponse({
        success: false,
        error: 'No content found. Please extract content first.'
      });
      return;
    }

    const content = tabData.content;

    await backgroundDataController.saveData(url, {
      processing: { citations: { isGenerating: true, error: null } }
    });

    const isPDF = (content.metadata as any)?.contentType === 'pdf' ||
                  (content.metadata as any)?.isPDF === true ||
                  url.toLowerCase().includes('.pdf') ||
                  url.toLowerCase().includes('arxiv.org/pdf/');

    let citationResult;

    if (isPDF && content.text && content.text.length > 100) {
      console.log('📄📚 Generating PDF citations with AI analysis');
      citationResult = await PDFCitationService.generateComprehensivePDFCitations(
        content.text, url, content.metadata
      );
    } else {
      console.log('📚 Generating regular citations from metadata');
      citationResult = await CitationService.generateCitations(content.metadata, url);
    }

    if (citationResult.success && citationResult.citations) {
      console.log('✅ Citations generated successfully');

      await backgroundDataController.saveData(url, {
        analysis: { citations: citationResult.citations },
        processing: { citations: { isGenerating: false, error: null } }
      });

      const resp: any = {
        success: true,
        citations: citationResult.citations,
        source: citationResult.source
      };
      if ('extractionMethod' in citationResult) resp.extractionMethod = citationResult.extractionMethod;
      if ('confidence' in citationResult) resp.confidence = citationResult.confidence;

      sendResponse(resp);
    } else {
      console.error('❌ Citation generation failed:', citationResult.error);

      await backgroundDataController.saveData(url, {
        processing: { citations: { isGenerating: false, error: citationResult.error || 'Citation generation failed' } }
      });

      sendResponse({
        success: false,
        error: citationResult.error || 'Failed to generate citations'
      });
    }

  } catch (error) {
    console.error('❌ Error generating citations:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    await backgroundDataController.saveData(url, {
      processing: { citations: { isGenerating: false, error: errorMessage } }
    });

    sendResponse({ success: false, error: errorMessage });
  }
}
