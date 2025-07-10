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
    
    // Send message to content script to extract content
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Content script communication failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: 'Failed to communicate with content script' });
        return;
      }
      
      if (response?.success) {
        console.log('✅ Content extraction successful');
        
        // Load the full TabData from data controller
        const fullTabData = await backgroundDataController.loadData(tab.url!, true);
        
        if (fullTabData && fullTabData.content) {
          // Check if this is a PDF and automatically generate citations
          const isPDF = (fullTabData.content.metadata as any)?.contentType === 'pdf' || 
                        (fullTabData.content.metadata as any)?.isPDF === true ||
                        tab.url!.toLowerCase().includes('.pdf') ||
                        tab.url!.toLowerCase().includes('arxiv.org/pdf/');
          
          if (isPDF && fullTabData.content.text && fullTabData.content.text.length > 100) {
            console.log('📄📚 Detected PDF content, automatically generating citations...');
            
            try {
              // Set citation processing status
              await backgroundDataController.saveData(tab.url!, {
                processing: { 
                  citations: { isGenerating: true, error: null }
                }
              });
              
              // First enhance the metadata with PDF-extracted data
              console.log('📄📚 Enhancing content metadata with PDF-extracted citations...');
              const enhancedMetadata = await PDFCitationService.enhanceMetadataWithPDFCitations(
                fullTabData.content.text,
                tab.url!,
                fullTabData.content.metadata
              );
              
              // Update the content with enhanced metadata
              await backgroundDataController.saveData(tab.url!, {
                content: {
                  ...fullTabData.content,
                  metadata: enhancedMetadata
                }
              });
              
              // Generate comprehensive PDF citations
              const citationResult = await PDFCitationService.generateComprehensivePDFCitations(
                fullTabData.content.text,
                tab.url!,
                enhancedMetadata
              );
              
              if (citationResult.success && citationResult.citations) {
                console.log('✅ PDF citations generated automatically');
                
                // Update the tab data with the generated citations
                await backgroundDataController.saveData(tab.url!, {
                  analysis: { 
                    citations: citationResult.citations
                  },
                  processing: { 
                    citations: { isGenerating: false, error: null }
                  }
                });
              } else {
                console.warn('⚠️ PDF citation generation failed, falling back to regular citation generation');
                
                // Fall back to regular citation generation
                const regularCitationResult = await CitationService.generateCitations(
                  fullTabData.content.metadata, 
                  tab.url!
                );
                
                if (regularCitationResult.success && regularCitationResult.citations) {
                  await backgroundDataController.saveData(tab.url!, {
                    analysis: { 
                      citations: regularCitationResult.citations
                    },
                    processing: { 
                      citations: { isGenerating: false, error: null }
                    }
                  });
                } else {
                  await backgroundDataController.saveData(tab.url!, {
                    processing: { 
                      citations: { isGenerating: false, error: regularCitationResult.error || 'Citation generation failed' }
                    }
                  });
                }
              }
              
            } catch (citationError) {
              console.error('❌ Error during automatic citation generation:', citationError);
              await backgroundDataController.saveData(tab.url!, {
                processing: { 
                  citations: { isGenerating: false, error: 'Citation generation failed' }
                }
              });
            }
          } else if (!isPDF && fullTabData.content.metadata && Object.keys(fullTabData.content.metadata).length > 0) {
            console.log('📚 Detected non-PDF content with metadata, generating regular citations...');
            
            try {
              // Set citation processing status
              await backgroundDataController.saveData(tab.url!, {
                processing: { 
                  citations: { isGenerating: true, error: null }
                }
              });
              
              // Generate regular citations
              const citationResult = await CitationService.generateCitations(
                fullTabData.content.metadata, 
                tab.url!
              );
              
              if (citationResult.success && citationResult.citations) {
                console.log('✅ Regular citations generated automatically');
                
                await backgroundDataController.saveData(tab.url!, {
                  analysis: { 
                    citations: citationResult.citations
                  },
                  processing: { 
                    citations: { isGenerating: false, error: null }
                  }
                });
              } else {
                await backgroundDataController.saveData(tab.url!, {
                  processing: { 
                    citations: { isGenerating: false, error: citationResult.error || 'Citation generation failed' }
                  }
                });
              }
              
            } catch (citationError) {
              console.error('❌ Error during regular citation generation:', citationError);
              await backgroundDataController.saveData(tab.url!, {
                processing: { 
                  citations: { isGenerating: false, error: 'Citation generation failed' }
                }
              });
            }
          }
        }
        
        // Return the updated TabData
        const updatedTabData = await backgroundDataController.loadData(tab.url!, true);
        sendResponse({ success: true, data: updatedTabData });
      } else {
        console.error('❌ Content extraction failed:', response?.error);
        sendResponse({ success: false, error: response?.error || 'Content extraction failed' });
      }
    });
    
  } catch (error) {
    console.error('❌ Handle content extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
} 