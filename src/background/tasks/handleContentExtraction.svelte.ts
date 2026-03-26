import { backgroundDataController } from '../index';
import { PDFCitationService } from '../../lib/services/pdfCitationService.svelte';
import { CitationService } from '../../lib/services/citationService.svelte';

export async function handleContentExtraction(tabId: number, sendResponse: (response: any) => void) {
  try {
    console.log('🔧 Extracting content for tab:', tabId);

    // Get tab info first
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      sendResponse({ success: false, error: 'No URL found for tab' });
      return;
    }

    // Validate tab URL
    if (tab.url.includes('chrome-extension://invalid') || tab.url === 'chrome-extension://invalid/') {
      console.warn('⚠️ Invalid chrome-extension URL detected in tab:', tab.url);
      sendResponse({ success: false, error: 'Invalid tab URL detected' });
      return;
    }

    // Skip system URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
      console.log('🔄 Skipping system URL:', tab.url);
      sendResponse({ success: false, error: 'Cannot extract content from system pages' });
      return;
    }

    console.log('🔧 Processing URL:', tab.url);

    // Send message to content script with retry (content script may not be injected yet)
    let response: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
        break; // Success — exit retry loop
      } catch (err) {
        if (attempt < 3) {
          console.warn(`⚠️ Content script not ready (attempt ${attempt}/3), retrying in ${attempt * 500}ms...`);
          await new Promise(r => setTimeout(r, attempt * 500));
        } else {
          console.error('❌ Content script communication failed after retries:', err);
          sendResponse({ success: false, error: 'Failed to communicate with content script. Try refreshing the page.' });
          return;
        }
      }
    }

    if (!response?.success) {
      console.error('❌ Content extraction failed:', response?.error);
      sendResponse({ success: false, error: response?.error || 'Content extraction failed' });
      return;
    }

    console.log('✅ Content extraction successful');

    // Use the cleaned URL from content script response if available,
    // since the content script strips tracking params (e.g. Twitter's &t=...)
    const dataUrl = response.content?.url || tab.url!;
    console.log('🔧 Loading data for URL:', dataUrl, '(tab URL:', tab.url!, ')');

    // Load the full TabData from data controller
    const fullTabData = await backgroundDataController.loadData(dataUrl, true);

    if (fullTabData && fullTabData.content) {
      // Check if this is a PDF and automatically generate citations
      const isPDF = (fullTabData.content.metadata as any)?.contentType === 'pdf' ||
                    (fullTabData.content.metadata as any)?.isPDF === true ||
                    dataUrl.toLowerCase().includes('.pdf') ||
                    dataUrl.toLowerCase().includes('arxiv.org/pdf/');

      if (isPDF && fullTabData.content.text && fullTabData.content.text.length > 100) {
        console.log('📄📚 Detected PDF content, automatically generating citations...');

        try {
          await backgroundDataController.saveData(dataUrl, {
            processing: { citations: { isGenerating: true, error: null } }
          });

          const enhancedMetadata = await PDFCitationService.enhanceMetadataWithPDFCitations(
            fullTabData.content.text, dataUrl, fullTabData.content.metadata
          );

          console.log('📄📚 Filename already generated during metadata enhancement:', enhancedMetadata.filename);

          await backgroundDataController.saveData(dataUrl, {
            content: { ...fullTabData.content, metadata: enhancedMetadata }
          });

          const citationResult = await PDFCitationService.generateComprehensivePDFCitations(
            fullTabData.content.text, dataUrl, enhancedMetadata
          );

          if (citationResult.success && citationResult.citations) {
            console.log('✅ PDF citations generated automatically');
            await backgroundDataController.saveData(dataUrl, {
              analysis: { citations: citationResult.citations },
              processing: { citations: { isGenerating: false, error: null } }
            });
          } else {
            console.warn('⚠️ PDF citation generation failed, falling back to regular citation generation');
            const regularCitationResult = await CitationService.generateCitations(
              fullTabData.content.metadata, dataUrl
            );
            if (regularCitationResult.success && regularCitationResult.citations) {
              await backgroundDataController.saveData(dataUrl, {
                analysis: { citations: regularCitationResult.citations },
                processing: { citations: { isGenerating: false, error: null } }
              });
            } else {
              await backgroundDataController.saveData(dataUrl, {
                processing: { citations: { isGenerating: false, error: regularCitationResult.error || 'Citation generation failed' } }
              });
            }
          }
        } catch (citationError) {
          console.error('❌ Error during automatic citation generation:', citationError);
          await backgroundDataController.saveData(dataUrl, {
            processing: { citations: { isGenerating: false, error: 'Citation generation failed' } }
          });
        }
      } else if (!isPDF && fullTabData.content.metadata && Object.keys(fullTabData.content.metadata).length > 0) {
        console.log('📚 Detected non-PDF content with metadata, generating regular citations...');

        try {
          await backgroundDataController.saveData(dataUrl, {
            processing: { citations: { isGenerating: true, error: null } }
          });

          const citationResult = await CitationService.generateCitations(
            fullTabData.content.metadata, dataUrl
          );

          if (citationResult.success && citationResult.citations) {
            console.log('✅ Regular citations generated automatically');
            await backgroundDataController.saveData(dataUrl, {
              analysis: { citations: citationResult.citations },
              processing: { citations: { isGenerating: false, error: null } }
            });
          } else {
            await backgroundDataController.saveData(dataUrl, {
              processing: { citations: { isGenerating: false, error: citationResult.error || 'Citation generation failed' } }
            });
          }
        } catch (citationError) {
          console.error('❌ Error during regular citation generation:', citationError);
          await backgroundDataController.saveData(dataUrl, {
            processing: { citations: { isGenerating: false, error: 'Citation generation failed' } }
          });
        }
      }
    }

    // Return the updated TabData
    const updatedTabData = await backgroundDataController.loadData(dataUrl, true);
    sendResponse({ success: true, data: updatedTabData });

  } catch (error) {
    console.error('❌ Handle content extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}
