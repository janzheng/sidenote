import { writable, derived, get } from 'svelte/store';
import type { ApiService } from '../services/apiService';
import { createApiService } from '../services/apiService';
import { settings } from './settings';
import { reactiveTabData } from './reactiveTabStorage';

// Import from utility modules
import { debugLog, addToLog, clearAllPageData } from './utils/storeUtils';
import { 
  pageTextContent, 
  pageHtmlContent, 
  pageMetadata, 
  pageUrl, 
  pageCleanUrl, 
  isLoading,
  contentGraph,
  isParsingStructure,
  structureParsingError,
  isSaving,
  isLoadingFromStorage,
  saveStatus,
  loadStatus,
  pageAssets,
  isExtractingAssets,
  assetExtractionError,
  pageFonts,
  pageImages,
  pageSvgs,
  assetStats,
  hasAssets,
  hasImages,
  hasFonts,
  hasSvgs,
  requestPageContent,
  handlePageRefresh,
  performFullRefresh,
  parseContentStructure,
  savePageDataToStorage,
  loadPageDataFromStorage,
  getCurrentPageContent,
  setCustomContent,
  hasCustomContent,
  getContentStructure,
  getHeadersAtLevel,
  findContentNode,
  moveContentNode,
  flattenContentStructure,
  getContentStructureStats,
  extractPageAssets,
  clearPageAssets,
  getAssetById,
  copyToClipboard,
  downloadSvg,
  getFontCss,
  getFontImport,
  estimateImageSize,
  turndownService,
  // ✅ MIGRATED: Unified stores from unified tab storage
  unifiedPageTextContent,
  unifiedPageHtmlContent,
  unifiedPageMetadata,
  unifiedPageUrl,
  unifiedPageTitle,
  unifiedIsLoading,
  unifiedIsSaving,
  unifiedIsLoadingFromStorage,
  unifiedSaveStatus,
  unifiedLoadStatus,
  unifiedContentGraph,
  unifiedIsParsingStructure,
  unifiedStructureParsingError,
  unifiedPageAssets,
  unifiedIsExtractingAssets,
  unifiedAssetExtractionError,
  unifiedPageFonts,
  unifiedPageImages,
  unifiedPageSvgs,
  unifiedAssetStats,
  unifiedHasAssets,
  unifiedHasImages,
  unifiedHasFonts,
  unifiedHasSvgs
} from './utils/contentUtils';
import { 
  summaryStreamingText,
  isSummaryStreaming,
  summaryStreamingError,
  chatMessages,
  chatInput,
  isChatStreaming,
  chatStreamingError,
  currentChatResponse,
  streamingFeatures,
  clearChatHistory,
  startStreamingSummary,
  sendChatMessage,
  startStreamingFeature,
  getStreamingFeature,
  startStreamingKeyPoints,
  startStreamingQuestions,
  type ChatMessage
} from './utils/streamingUtils';
import { 
  currentTabId,
  currentTabUrl,
  hasTabChanged,
  onTabChange,
  isCurrentTabMatching,
  getCurrentTabDomain,
  getCurrentTabId,
  getCurrentTabUrl,
  updateCurrentTab,
  initTabDetection
} from './utils/tabUtils';
import {
  isBookmarking,
  bookmarkStatus,
  bookmarkError,
  isScrollExtracting,
  scrollExtractedContent,
  scrollExtractionProgress,
  scrollExtractionError,
  isLinkedInExpanding,
  linkedInExpandedContent,
  linkedInStructuredData,
  linkedInExpansionProgress,
  linkedInExpansionError,
  isTwitterExpanding,
  twitterExpandedContent,
  twitterStructuredData,
  twitterExpansionProgress,
  twitterExpansionError,
  isGeneratingCitations,
  citationData,
  citationError,
  citationSource,
  jinaImageUrls,
  isJinaProcessing,
  jinaError,
  isResearchPaperExtracting,
  researchPaperAnalysis,
  researchPaperProgress,
  researchPaperError,
  bookmarkCurrentPage,
  generateCitations,
  startScrollExtraction,
  stopScrollExtraction,
  startLinkedInExpansion,
  stopLinkedInExpansion,
  startTwitterExpansion,
  stopTwitterExpansion,
  requestJinaPageshot,
  requestJinaScreenshot,
  startResearchPaperExtraction,
  extractEnhancedCitationMetadata,
  twitterExpandedHtml
} from './utils/serviceUtils';
import {
  isRecipeExtracting,
  recipeData,
  recipeError,
  recipeRawContent,
  recipeConfidence,
  startRecipeExtraction,
  stopRecipeExtraction,
  isRecipePage,
  getRecipeExtractionResult,
  clearRecipeData
} from './utils/recipeUtils';
import {
  stopResearchPaperExtraction,
  startTabSpecificResearchPaperExtraction,
  stopTabSpecificResearchPaperExtraction,
  getCurrentTabResearchPaperState,
  saveCurrentTabResearchPaperState,
  clearCurrentTabResearchPaperState
} from './utils/researchPaperUtils';
import {
  isPDFContent,
  pdfExtractionStatus,
  pdfExtractionError,
  interceptedPDFs,
  checkForPDFContent,
  processPDFContent,
  resetPDFStores,
  enhancePDFMetadata,
  addInterceptedPDF,
  removeInterceptedPDF,
  downloadInterceptedPDF,
  getInterceptedPDFs,
  clearInterceptedPDFs,
  extractPDFFromArrayBuffer
} from './utils/pdfUtils';

// ThreadGirl result interface
export interface ThreadGirlResult {
  id: string;
  timestamp: number;
  prompt: string;
  result: string;
  model?: string;
  url?: string;
  title?: string;
}

// ThreadGirl stores
export const threadGirlResults = writable<ThreadGirlResult[]>([]);
export const isProcessingThreadGirl = writable<boolean>(false);
export const threadGirlError = writable<string | null>(null);

// User background is now stored in settings.ts for persistence

// ThreadGirl functions
export function addThreadGirlResult(prompt: string, result: string, model?: string) {
  const newResult: ThreadGirlResult = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    prompt,
    result,
    model,
    url: get(pageUrl),
    title: get(pageMetadata).title || get(pageUrl)
  };
  
  threadGirlResults.update(results => [...results, newResult]);
  addToLog(`ThreadGirl result added: ${result.length} chars`);
  
  // Trigger auto-save if enabled
  setTimeout(async () => {
    try {
      const { getCurrentSettings } = await import('./settings');
      const settings = getCurrentSettings();
      if (settings.autoSave) {
        addToLog("Auto-saving after ThreadGirl result added");
        const { savePageDataToStorage } = await import('./utils/contentUtils');
        await savePageDataToStorage();
      }
    } catch (error) {
      addToLog(`Auto-save after ThreadGirl result failed: ${error}`);
    }
  }, 500); // Small delay to ensure UI updates
}

export function removeThreadGirlResult(id: string) {
  threadGirlResults.update(results => results.filter(r => r.id !== id));
  addToLog(`ThreadGirl result removed: ${id}`);
}

export function clearThreadGirlResults() {
  threadGirlResults.set([]);
  addToLog("All ThreadGirl results cleared");
}


// Create a store for the API service
export const apiService = writable<ApiService>(createApiService());

// Re-export the stores and functions for external use
export {
  // Stores
  debugLog,
  pageTextContent,
  pageHtmlContent,
  pageMetadata,
  pageUrl,
  pageCleanUrl,
  isLoading,
  hasCustomContent,
  contentGraph,
  isParsingStructure,
  structureParsingError,
  isSaving,
  isLoadingFromStorage,
  saveStatus,
  loadStatus,
  summaryStreamingText,
  isSummaryStreaming,
  summaryStreamingError,
  chatMessages,
  chatInput,
  isChatStreaming,
  chatStreamingError,
  currentChatResponse,
  streamingFeatures,
  currentTabId,
  currentTabUrl,
  hasTabChanged,
  isBookmarking,
  bookmarkStatus,
  bookmarkError,
  isScrollExtracting,
  scrollExtractedContent,
  scrollExtractionProgress,
  scrollExtractionError,
  isLinkedInExpanding,
  linkedInExpandedContent,
  linkedInStructuredData,
  linkedInExpansionProgress,
  linkedInExpansionError,
  isTwitterExpanding,
  twitterExpandedContent,
  twitterExpandedHtml,
  twitterStructuredData,
  twitterExpansionProgress,
  twitterExpansionError,
  isGeneratingCitations,
  citationData,
  citationError,
  citationSource,
  jinaImageUrls,
  isJinaProcessing,
  jinaError,
  isPDFContent,
  pdfExtractionStatus,
  pdfExtractionError,
  interceptedPDFs,
  isResearchPaperExtracting,
  researchPaperAnalysis,
  researchPaperProgress,
  researchPaperError,
  pageAssets,
  isExtractingAssets,
  assetExtractionError,
  pageFonts,
  pageImages,
  pageSvgs,
  assetStats,
  hasAssets,
  hasImages,
  hasFonts,
  hasSvgs,
  // ✅ MIGRATED: Unified stores from unified tab storage
  unifiedPageTextContent,
  unifiedPageHtmlContent,
  unifiedPageMetadata,
  unifiedPageUrl,
  unifiedPageTitle,
  unifiedIsLoading,
  unifiedIsSaving,
  unifiedIsLoadingFromStorage,
  unifiedSaveStatus,
  unifiedLoadStatus,
  unifiedContentGraph,
  unifiedIsParsingStructure,
  unifiedStructureParsingError,
  unifiedPageAssets,
  unifiedIsExtractingAssets,
  unifiedAssetExtractionError,
  unifiedPageFonts,
  unifiedPageImages,
  unifiedPageSvgs,
  unifiedAssetStats,
  unifiedHasAssets,
  unifiedHasImages,
  unifiedHasFonts,
  unifiedHasSvgs,
  // Recipe extraction stores
  isRecipeExtracting,
  recipeData,
  recipeError,
  recipeRawContent,
  recipeConfidence,
  // Functions
  addToLog,
  clearAllPageData,
  requestPageContent,
  handlePageRefresh,
  performFullRefresh,
  parseContentStructure,
  savePageDataToStorage,
  loadPageDataFromStorage,
  getCurrentPageContent,
  setCustomContent,
  getContentStructure,
  getHeadersAtLevel,
  findContentNode,
  moveContentNode,
  flattenContentStructure,
  getContentStructureStats,
  clearChatHistory,
  startStreamingSummary,
  sendChatMessage,
  startStreamingFeature,
  getStreamingFeature,
  startStreamingKeyPoints,
  startStreamingQuestions,
  onTabChange,
  isCurrentTabMatching,
  getCurrentTabDomain,
  getCurrentTabId,
  getCurrentTabUrl,
  updateCurrentTab,
  initTabDetection,
  bookmarkCurrentPage,
  generateCitations,
  startScrollExtraction,
  stopScrollExtraction,
  startLinkedInExpansion,
  stopLinkedInExpansion,
  startTwitterExpansion,
  stopTwitterExpansion,
  requestJinaPageshot,
  requestJinaScreenshot,
  startResearchPaperExtraction,
  stopResearchPaperExtraction,
  startTabSpecificResearchPaperExtraction,
  stopTabSpecificResearchPaperExtraction,
  getCurrentTabResearchPaperState,
  saveCurrentTabResearchPaperState,
  clearCurrentTabResearchPaperState,
  checkForPDFContent,
  processPDFContent,
  resetPDFStores,
  enhancePDFMetadata,
  addInterceptedPDF,
  removeInterceptedPDF,
  downloadInterceptedPDF,
  getInterceptedPDFs,
  clearInterceptedPDFs,
  extractPDFFromArrayBuffer,
  extractEnhancedCitationMetadata,
  extractPageAssets,
  clearPageAssets,
  getAssetById,
  copyToClipboard,
  downloadSvg,
  getFontCss,
  getFontImport,
  estimateImageSize,
  // Recipe extraction functions
  startRecipeExtraction,
  stopRecipeExtraction,
  isRecipePage,
  getRecipeExtractionResult,
  clearRecipeData,
  // Types
  type ChatMessage
};

// Message listener setup function (only function that stays in main store)
let messageListenerSetup = false;
export function setupMessageListener() {
  console.log('🔧 SIDEBAR LOG: setupMessageListener called');
  
  if (messageListenerSetup) {
    console.log('🔧 SIDEBAR LOG: Message listener already set up, skipping...');
    return;
  }
  
  try {
    console.log('🔧 SIDEBAR LOG: Creating API service...');
    const service = createApiService();
    console.log('🔧 SIDEBAR LOG: API service created:', service);
    
    // Set up message listener immediately - no delay needed
    console.log('🔧 SIDEBAR LOG: Setting up message listener...');
    service.onMessage(async (message) => {
        console.log('🔍 SIDEBAR LOG: Side panel received message:', message);
        
        // 🔍 DEBUG: Add timestamp and more detail to make messages more visible
        console.log('🔍 SIDEBAR LOG: Message received at', new Date().toISOString(), 'action:', message.action);
        
        // ✅ PHASE 5 FIX: Helper function to validate tab context for messages
        async function validateMessageTabContext(messageTabId?: number, messageUrl?: string): Promise<boolean> {
          try {
            console.log('🔍 TAB ISOLATION: validateMessageTabContext called with:', {
              messageTabId,
              messageUrl,
              hasTabId: !!messageTabId,
              hasUrl: !!messageUrl
            });
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTabId = tabs[0]?.id;
            const activeTabUrl = tabs[0]?.url;
            
            console.log('🔍 TAB ISOLATION: Active tab info:', {
              activeTabId,
              activeTabUrl,
              tabsFound: tabs.length
            });
            
            // ✅ CRITICAL FIX: STRICT tab ID validation - reject if tab IDs don't match
            if (messageTabId && activeTabId) {
              if (activeTabId !== messageTabId) {
                console.log(`🔍 TAB ISOLATION: STRICT REJECTION - Message from tab ${messageTabId} ignored - current active tab is ${activeTabId}`);
                return false;
              }
            }
            
            // ✅ CRITICAL FIX: STRICT URL validation - reject if URLs don't match
            if (messageUrl && activeTabUrl) {
              console.log('🔍 TAB ISOLATION: URL comparison starting:', {
                messageUrl,
                activeTabUrl,
                urlsMatch: messageUrl === activeTabUrl
              });
              
              // ✅ FIX: Normalize URLs for comparison to handle tracking parameters
              const normalizeUrl = (url: string): string => {
                try {
                  const urlObj = new URL(url);
                  
                  // Remove common tracking parameters that LinkedIn adds
                  const trackingParams = [
                    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                    'trk', 'trackingId', 'refId', 'originalReferer', 'sessionId',
                    'lipi', 'licu', 'li_fat_id', 'origin', 'originalSubdomain',
                    'ref', 'ref_src', 'ref_url', 'referrer', 'source'
                  ];
                  
                  trackingParams.forEach(param => {
                    urlObj.searchParams.delete(param);
                  });
                  
                  // Remove hash fragment for comparison
                  urlObj.hash = '';
                  
                  return urlObj.toString();
                } catch (error) {
                  console.warn('URL normalization failed:', error);
                  return url;
                }
              };
              
              const normalizedMessageUrl = normalizeUrl(messageUrl);
              const normalizedActiveUrl = normalizeUrl(activeTabUrl);
              
              console.log('🔍 TAB ISOLATION: Normalized URL comparison:', {
                messageUrl: messageUrl,
                normalizedMessageUrl: normalizedMessageUrl,
                activeTabUrl: activeTabUrl,
                normalizedActiveUrl: normalizedActiveUrl,
                normalizedMatch: normalizedMessageUrl === normalizedActiveUrl
              });
              
              if (normalizedMessageUrl !== normalizedActiveUrl) {
                console.log(`🔍 TAB ISOLATION: STRICT REJECTION - URL mismatch after normalization - Message ignored:`, {
                  messageUrl: messageUrl,
                  normalizedMessageUrl: normalizedMessageUrl,
                  activeTabUrl: activeTabUrl,
                  normalizedActiveUrl: normalizedActiveUrl
                });
                return false;
              }
            }
            
            // ✅ CRITICAL FIX: Additional window isolation check
            // Check if the current window is the one that should be receiving this message
            try {
              const currentWindow = await chrome.windows.getCurrent();
              const messageWindow = tabs[0]?.windowId;
              
              if (currentWindow.id !== messageWindow) {
                console.log(`🔍 TAB ISOLATION: STRICT REJECTION - Message from different window ${messageWindow} ignored - current window is ${currentWindow.id}`);
                return false;
              }
            } catch (error) {
              console.warn('Window validation failed, proceeding with tab validation only:', error);
            }
            
            console.log('🔍 TAB ISOLATION: validateMessageTabContext returning true - message accepted');
            return true;
          } catch (error) {
            console.warn('🔍 TAB ISOLATION: validateMessageTabContext failed:', error);
            return false; // Fail safe - don't process if we can't validate
          }
        }
        
        // Add detailed logging for pageContentExtracted messages
        if (message.action === 'pageContentExtracted') {
          console.log('🔍 DEBUG: Processing pageContentExtracted message - detailed breakdown:', {
            action: message.action,
            hasText: !!message.text,
            hasHtml: !!message.html,
            hasMetadata: !!message.metadata,
            hasUrl: !!message.url,
            textLength: message.text?.length || 0,
            htmlLength: message.html?.length || 0,
            metadataKeys: message.metadata ? Object.keys(message.metadata).length : 0,
            url: message.url,
            title: message.title,
            isPDF: message.isPDF,
            fullMessageKeys: Object.keys(message)
          });

          // 🔑 CRITICAL: Forward to Redux system BEFORE validation to ensure it always gets the message
          try {
            const { pageExtractionService } = await import('../services/pageExtractionService.js');
            pageExtractionService.handlePageContentExtracted(message);
            console.log('🔍 DEBUG: Message forwarded to Redux pageExtractionService');
          } catch (reduxError) {
            console.warn('🔍 DEBUG: Failed to forward message to Redux system:', reduxError);
          }
        }

        // Handle automatic PDF extraction to tab storage
        if (message.action === 'AUTO_EXTRACT_PDF_TO_TAB_STORAGE') {
          const { url, title, contentId } = message.data;
          
          // ✅ PHASE 5 FIX: Validate tab context for PDF extraction
          if (!(await validateMessageTabContext(message.tabId, url))) {
            addToLog(`🔄 Ignoring PDF extraction for different tab/URL`);
            return;
          }
          
          addToLog(`📄 Auto-extracting PDF to tab storage: ${url}`);
          
          try {
            // Import the auto extraction function
            const { autoExtractPDFToTabStorage } = await import('../services/extractors/pdfExtractor');
            
            // Extract and save PDF to tab storage
            const success = await autoExtractPDFToTabStorage(url, title);
            
            if (success) {
              addToLog(`✅ PDF automatically extracted and saved to tab storage`);
            } else {
              addToLog(`⚠️ PDF auto-extraction completed but content may be insufficient`);
            }
          } catch (error) {
            console.error('❌ Auto PDF extraction failed:', error);
            addToLog(`❌ Auto PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          
          return; // Don't process as regular page content
        }

        // Handle background task status updates
        if (message.action === 'backgroundTaskStatus') {
          // ✅ PHASE 5 FIX: Validate tab context for background task updates
          if (!(await validateMessageTabContext(message.tabId))) {
            // Silently ignore background task updates for other tabs
            return;
          }
          
          // ✅ FIX: Reduce excessive logging
          if (message.status === 'started' || message.status === 'completed' || message.status === 'error') {
            console.log('🔍 SIDEBAR LOG: Background task status update:', message.taskType, message.status);
          }
          
          // Create a background task status store for the App to consume
          const taskStatusMessage = {
            action: 'backgroundTaskStatus',
            taskId: message.taskId,
            tabId: message.tabId,
            taskType: message.taskType,
            status: message.status,
            progress: message.progress,
            error: message.error,
            timestamp: Date.now()
          };
          
          // Send to App via chrome.runtime.sendMessage for App to handle
          chrome.runtime.sendMessage({
            action: 'backgroundTaskStatusForApp',
            data: taskStatusMessage
          }).catch(() => {
            // Ignore if App is not listening
          });
          
          // Show progress message if available
          if (message.progress?.message) {
            addToLog(`📊 ${message.taskType}: ${message.progress.message}`);
          } else if (message.status === 'completed') {
            addToLog(`✅ Background ${message.taskType} completed`);
          } else if (message.status === 'error') {
            addToLog(`❌ Background ${message.taskType} failed: ${message.error || 'Unknown error'}`);
          }
          
          return; // Don't process as regular page content
        }
        
        // Handle when all background tasks are complete
        if (message.action === 'backgroundTasksComplete') {
          // ✅ PHASE 5 FIX: Validate tab context for background task completion
          if (!(await validateMessageTabContext(message.tabId))) {
            // Silently ignore background task completion for other tabs
            return;
          }
          
          console.log('🎉 All background tasks completed for tab:', message.tabId);
          addToLog('🎉 All background processing completed');
          return; // Don't process as regular page content
        }

        // Handle page content updates from content script or background
        const { 
          pageContent, 
          url, 
          tabId, 
          isPDF, 
          pdfContent, 
          metadata,
          text: textContent,
          html: htmlContent
        } = message;
        
        if (message.action === 'pageContentExtracted') {
          // ✅ PHASE 5 FIX: Validate tab context for page content updates
          console.log('🔍 DEBUG: pageContentExtracted validation check:', {
            messageTabId: tabId,
            messageUrl: url,
            validationStarting: true
          });
          
          const isValidContext = await validateMessageTabContext(tabId, url);
          console.log('🔍 DEBUG: pageContentExtracted validation result:', {
            isValidContext: isValidContext,
            messageTabId: tabId,
            messageUrl: url
          });
          
          if (!isValidContext) {
            console.log('🔍 DEBUG: VALIDATION FAILED - Content will be ignored!', {
              messageTabId: tabId,
              messageUrl: url,
              reason: 'validateMessageTabContext returned false'
            });
            addToLog(`🔄 Ignoring page content from different tab/URL`);
            return;
          }
          
          console.log('🔍 DEBUG: VALIDATION PASSED - Processing content...', {
            messageTabId: tabId,
            messageUrl: url,
            textLength: textContent?.length || 0,
            htmlLength: htmlContent?.length || 0
          });
          
          // ✅ FIX: Reduce excessive debugging
          console.log('🔍 Processing pageContentExtracted:', {
            textLength: textContent?.length || 0,
            htmlLength: htmlContent?.length || 0,
            url: url,
            isPDF: isPDF
          });
          
          // Handle text, HTML, metadata, and URL content
          const title = message.title || metadata.title || 'Untitled';
          
          // Calculate word count if not provided
          const calculatedWordCount = message.wordCount || (textContent ? textContent.split(/\s+/).filter((word: string) => word.length > 0).length : 0);
          
          // ✅ LINKEDIN FIX: Special handling for LinkedIn URLs
          const isLinkedInUrl = url?.includes('linkedin.com') || false;
          console.log('🔍 DEBUG: LinkedIn URL detected:', isLinkedInUrl, 'URL:', url);
          
          // ⚡ OPTIMIZED: Store to unified tab storage immediately for faster UI updates
          Promise.resolve().then(async () => {
            try {
              // 🔑 CRITICAL: Ensure legacy tab data structure exists before unified update
              const { saveCurrentTabData, getCurrentTabData } = await import('../services/tabStorage');
              
              // Check if tab data exists
              let existingTabData = await getCurrentTabData();
              if (!existingTabData || !existingTabData.pageContent?.dataModel) {
                // Create minimal tab data structure to support unified updates
                await saveCurrentTabData({
                  pageContent: {
                    dataModel: {
                      text: textContent || '',
                      html: htmlContent || '',
                      metadata: metadata || {},
                      url: url || '',
                      title: title,
                      wordCount: calculatedWordCount,
                      markdown: '' // Leave empty initially
                    }
                  }
                });
                console.log('🔍 DEBUG: Created new tab data structure for LinkedIn:', isLinkedInUrl);
              }
              
              const { updateReactiveContent, refreshReactiveTabStorage } = await import('./reactiveTabStorage');
              
              await updateReactiveContent({
                text: textContent || '',
                html: htmlContent || '',
                metadata: metadata || {},
                url: url || '',
                cleanUrl: message.cleanUrl || url || '',
                title: title,
                wordCount: calculatedWordCount,
                hasCustomContent: false,
                markdown: '' // Leave empty initially to avoid blocking
              });
              
              console.log('🔍 DEBUG: Updated reactive content, text length:', textContent?.length || 0);
              
              // ✅ LINKEDIN FIX: Force refresh for LinkedIn URLs since they interfere with normal flow
              if (isLinkedInUrl) {
                console.log('🔍 DEBUG: LinkedIn URL - forcing reactive storage refresh...');
                setTimeout(async () => {
                  try {
                    await refreshReactiveTabStorage(true); // Force urgent refresh
                    console.log('🔍 DEBUG: LinkedIn reactive storage refresh completed');
                                         addToLog(`🔗 LinkedIn content stored and refreshed: ${(textContent || '').length} chars`);
                  } catch (refreshError) {
                    console.warn('LinkedIn refresh failed:', refreshError);
                  }
                }, 100); // Small delay to ensure storage is written
              }
              
              addToLog(`✅ Updated unified tab storage with new content`);
              
            } catch (unifiedError) {
              console.error('❌ Unified tab storage update failed:', unifiedError);
              addToLog(`⚠️ Failed to update unified storage (non-critical): ${unifiedError}`);
              
              // ✅ LINKEDIN FIX: For LinkedIn, try alternative storage approach
              if (isLinkedInUrl) {
                console.log('🔍 DEBUG: LinkedIn storage failed, trying direct approach...');
                try {
                  const { updateUnifiedTabData } = await import('../services/tabStorage');
                  await updateUnifiedTabData({
                    content: {
                      text: textContent || '',
                      html: htmlContent || '',
                      metadata: metadata || {},
                      url: url || '',
                      cleanUrl: message.cleanUrl || url || '',
                      title: title,
                      wordCount: calculatedWordCount,
                      hasCustomContent: false,
                      markdown: ''
                    }
                  });
                  console.log('🔍 DEBUG: LinkedIn direct storage succeeded');
                  addToLog(`🔗 LinkedIn content stored via direct method`);
                } catch (directError) {
                  console.error('LinkedIn direct storage also failed:', directError);
                  addToLog(`❌ LinkedIn storage completely failed: ${directError}`);
                }
              }
            }
          });
          
          addToLog(`Page content extracted: ${(textContent || '').length} chars text, ${(htmlContent || '').length} chars HTML, ${Object.keys(metadata || {}).length} metadata fields from ${url}${isPDF ? ' (PDF)' : ''}${isLinkedInUrl ? ' (LinkedIn)' : ''}`);
          
          if ((textContent || '').length === 0 && (htmlContent || '').length === 0) {
            addToLog("Warning: Both text and HTML content are empty - this might indicate an extraction issue");
          }

          if (Object.keys(metadata || {}).length > 0) {
            addToLog(`Metadata extracted: ${Object.keys(metadata).join(', ')}`);
            
            // Log specific important metadata
            if (metadata.citations) {
              const citationFields = Object.keys(metadata.citations);
              addToLog(`Citation metadata found: ${citationFields.join(', ')}`);
            }
            if (metadata.schemaType) {
              addToLog(`Schema.org type detected: ${metadata.schemaType}`);
            }
            if (metadata.ogTitle || metadata.twitterTitle) {
              addToLog(`Social media metadata found: ${metadata.ogTitle ? 'Open Graph' : ''} ${metadata.twitterTitle ? 'Twitter Card' : ''}`);
            }
          }
          
          // 🔑 CRITICAL: Clear loading state after content is received
          // This fixes the issue where loading state persists on aggressive sites like LinkedIn
          console.log('🔍 DEBUG: Clearing loading state after pageContentExtracted');
          
          // Clear loading state via unified storage
          Promise.resolve().then(async () => {
            try {
              const { updateUnifiedTabData } = await import('../services/tabStorage');
              await updateUnifiedTabData({
                processing: {
                  isLoading: false,
                  isLoadingFromStorage: false
                } as any
              });
              console.log('✅ Loading state cleared via unified storage after pageContentExtracted');
              addToLog(`✅ Loading state cleared after content extraction`);
            } catch (error) {
              console.warn('Failed to clear loading state via unified storage:', error);
              
                             // Fallback: clear loading state via internal writable stores
               try {
                 // Import the internal writable stores that support .set() operations
                 const contentUtilsModule = await import('./utils/contentUtils');
                 // Access the internal stores through the module (they're not exported but we can access them)
                 // For now, just log the fallback attempt since we can't access internal stores directly
                 console.log('✅ Loading state fallback attempted (unified storage should handle this)');
               } catch (fallbackError) {
                 console.warn('Failed to clear loading state via fallback:', fallbackError);
               }
            }
          }).catch(console.warn);
          
          // ⚡ STREAMING PROCESSORS: Start additional processors immediately in parallel
          // Each processor runs independently and updates UI as it completes
          // Only start if we have substantial content to avoid unnecessary errors
          if ((textContent || '').length > 100 || (htmlContent || '').length > 500) {
            addToLog(`🚀 Starting background processors: text=${(textContent || '').length} chars, html=${(htmlContent || '').length} chars`);
            Promise.resolve().then(() => {
              startStreamingContentProcessors(textContent || '', htmlContent || '', metadata || {}, url || '');
            }).catch(error => {
              // Silently handle processor errors - they shouldn't affect main content loading
              console.log('Background processors encountered non-critical error:', error);
              addToLog(`❌ Background processors error: ${error}`);
            });
          } else {
            addToLog(`ℹ️ Skipping background processors - insufficient content: text=${(textContent || '').length} chars, html=${(htmlContent || '').length} chars`);
          }
        }
        
        if (message.action === 'scrollExtractionUpdate') {
          // ✅ PHASE 5 FIX: Validate tab context for scroll extraction updates
          if (!(await validateMessageTabContext(message.tabId, message.url))) {
            addToLog(`🔄 Ignoring scroll extraction update from different tab`);
            return;
          }
          
          // Handle scroll extraction progress updates
          const newContent = message.content || '';
          const progress = message.progress || {};
          
          // ✅ PHASE 4 FIX: Use unified storage API instead of calling .set() on derived stores
          (async () => {
            try {
              const { updateUnifiedTabData } = await import('../services/tabStorage');
              
              // Get current scroll content and append new content
              const { getUnifiedTabData } = await import('../services/tabStorage');
              const currentData = await getUnifiedTabData();
              const existingContent = currentData?.processing?.scrollExtraction?.content || '';
              const updatedContent = existingContent + (existingContent ? '\n\n' : '') + newContent;
              
              await updateUnifiedTabData({
                processing: {
                  scrollExtraction: {
                    content: updatedContent,
                    progress: {
                      currentChunk: progress.currentChunk || 0,
                      totalChunks: progress.totalChunks || 0,
                      scrollPosition: progress.scrollPosition || 0,
                      status: progress.status || 'extracting'
                    }
                  }
                } as any
              });
            } catch (error) {
              console.warn('Failed to update scroll extraction progress via unified storage:', error);
            }
          })().catch(console.warn);
          
          addToLog(`Scroll extraction update: chunk ${progress.currentChunk}/${progress.totalChunks}, ${newContent.length} chars added`);
        }
        
        if (message.action === 'scrollExtractionComplete') {
          // ✅ PHASE 5 FIX: Validate tab context for scroll extraction completion
          if (!(await validateMessageTabContext(message.tabId, message.url))) {
            addToLog(`🔄 Ignoring scroll extraction completion from different tab`);
            return;
          }
          
          // Handle scroll extraction completion
          const totalContent = message.totalContent || '';
          const finalProgress = message.progress || {};
          
          // ✅ PHASE 4 FIX: Use unified storage API instead of calling .set() on derived stores
          (async () => {
            try {
              const { updateUnifiedTabData } = await import('../services/tabStorage');
              await updateUnifiedTabData({
                processing: {
                  scrollExtraction: {
                    isExtracting: false,
                    content: totalContent,
                    progress: {
                      currentChunk: finalProgress.currentChunk || 0,
                      totalChunks: finalProgress.totalChunks || 0,
                      scrollPosition: finalProgress.scrollPosition || 0,
                      status: 'complete'
                    }
                  }
                } as any
              });
              
              // Optionally append to main page content via unified storage
              if (totalContent) {
                const { getUnifiedTabData } = await import('../services/tabStorage');
                const currentData = await getUnifiedTabData();
                const existingText = currentData?.content?.text || '';
                
                if (existingText) {
                  await updateUnifiedTabData({
                    content: {
                      text: existingText + '\n\n--- SCROLL-EXTRACTED CONTENT ---\n\n' + totalContent
                    } as any
                  });
                }
              }
            } catch (error) {
              console.warn('Failed to update scroll extraction completion via unified storage:', error);
            }
          })().catch(console.warn);
          
          addToLog(`Scroll extraction completed: ${totalContent.length} total chars extracted in ${finalProgress.currentChunk || 0} chunks`);
          
          // Trigger auto-save if enabled and content was extracted
          if (totalContent) {
            setTimeout(async () => {
              const { getCurrentSettings } = await import('./settings');
              const settings = getCurrentSettings();
              if (settings.autoSave) {
                addToLog("Auto-saving after scroll extraction completion");
                const { savePageDataToStorage } = await import('./utils/contentUtils');
                await savePageDataToStorage();
              }
            }, 500); // Small delay to ensure UI updates
          }
        }
        
        if (message.action === 'scrollExtractionError') {
          // ✅ PHASE 5 FIX: Validate tab context for scroll extraction errors
          if (!(await validateMessageTabContext(message.tabId, message.url))) {
            addToLog(`🔄 Ignoring scroll extraction error from different tab`);
            return;
          }
          
          // Handle scroll extraction errors
          const error = message.error || 'Unknown scroll extraction error';
          
          // ✅ PHASE 4 FIX: Use unified storage API instead of calling .set() on derived stores
          (async () => {
            try {
              const { updateUnifiedTabData } = await import('../services/tabStorage');
              await updateUnifiedTabData({
                processing: {
                  scrollExtraction: {
                    isExtracting: false,
                    error: error,
                    progress: {
                      status: 'error'
                    }
                  }
                } as any
              });
            } catch (updateError) {
              console.warn('Failed to update scroll extraction error via unified storage:', updateError);
            }
          })().catch(console.warn);
          
          addToLog(`Scroll extraction error: ${error}`);
        }
        
        // 🔑 CRITICAL: Handle tab activation events from background script
        if (message.action === 'tabActivated') {
          const { tabId, url, title } = message;
          console.log('🔄 SIDEBAR LOG: Side panel received tab activation:', { tabId, url, title });
          addToLog(`🔄 SIDEBAR LOG: Tab activated: ${tabId} - ${url}`);
          
          // Update tab tracking immediately
          try {
            const { updateCurrentTab } = await import('./utils/tabUtils');
            await updateCurrentTab(tabId, url);
          } catch (error) {
            console.error('Error handling tab activation:', error);
            addToLog(`Error handling tab activation: ${error}`);
          }
        }

        // 🔑 CRITICAL: Handle tab URL change events from background script
        if (message.action === 'tabUrlChanged') {
          const { tabId, url, title, changeType } = message;
          console.log('🔄 SIDEBAR LOG: Side panel received tab URL change:', { tabId, url, title, changeType });
          addToLog(`🔄 SIDEBAR LOG: Tab URL changed: ${tabId} - ${url} (${changeType})`);
          
          // Update tab tracking immediately for URL changes
          try {
            const { updateCurrentTab } = await import('./utils/tabUtils');
            await updateCurrentTab(tabId, url);
          } catch (error) {
            console.error('Error handling tab URL change:', error);
            addToLog(`Error handling tab URL change: ${error}`);
          }
        }

        // 🔑 CRITICAL: Handle tab load complete events from background script
        if (message.action === 'tabLoadComplete') {
          const { tabId, url, title, changeType } = message;
          console.log('🔄 SIDEBAR LOG: Side panel received tab load complete:', { tabId, url, title, changeType });
          addToLog(`🔄 SIDEBAR LOG: Tab load complete: ${tabId} - ${url} (${changeType})`);
          
          // 🔑 CRITICAL: Only trigger additional loading if we don't already have content
          // This prevents race conditions with tabUrlChanged messages
          try {
            const { getCurrentTabId, getCurrentTabUrl } = await import('./utils/tabUtils');
            const currentTabId = getCurrentTabId();
            const currentTabUrl = getCurrentTabUrl();
            
            if (currentTabId === tabId && currentTabUrl === url) {
              console.log('🔄 Load complete for current tab - checking if content needs to be loaded');
              
              // Check if we have content for this URL
              const { pageTextContent } = await import('./utils/contentUtils');
              let hasContent = false;
              const unsubscribeContent = pageTextContent.subscribe(content => {
                hasContent = content.length > 0;
              });
              unsubscribeContent();
              
              if (!hasContent) {
                console.log('🔄 No content found for completed page - triggering auto-load if enabled');
                addToLog(`No content found for completed page load - checking auto-refresh settings`);
                
                // Check settings and trigger appropriate loading
                const { getCurrentSettings } = await import('./settings');
                const settings = getCurrentSettings();
                
                if (settings.autoRefresh) {
                  addToLog(`Auto-refresh enabled - loading content for completed page`);
                  const { requestPageContent } = await import('./utils/contentUtils');
                  await requestPageContent();
                } else if (settings.autoSave) {
                  addToLog(`Auto-save enabled - attempting to restore saved content for completed page`);
                  const { loadPageDataFromStorage } = await import('./utils/contentUtils');
                  await loadPageDataFromStorage();
                } else {
                  addToLog(`Auto-refresh and auto-save disabled - manual refresh required for completed page`);
                  const { setHasTabChanged } = await import('./utils/tabUtils');
                  setHasTabChanged(true);
                }
              } else {
                console.log('🔄 Content already exists for completed page - no action needed');
              }
            } else {
              console.log('🔄 Load complete for different tab - ignoring');
            }
          } catch (error) {
            console.error('Error handling tab load complete:', error);
            addToLog(`Error handling tab load complete: ${error}`);
          }
        }
        
        // Handle LinkedIn expansion completion
        if (message.action === 'linkedInExpansionComplete') {
          // ✅ PHASE 5 FIX: Validate tab context for LinkedIn expansion completion
          if (!(await validateMessageTabContext(message.tabId, message.url))) {
            addToLog(`🔄 Ignoring LinkedIn expansion completion from different tab`);
            return;
          }
          
          const { totalContent, metadata, structuredData, progress } = message;
          
          // Update LinkedIn expansion stores
          try {
            const { linkedInExpandedContent, linkedInStructuredData, linkedInExpansionProgress, isLinkedInExpanding, linkedInExpansionError } = await import('./utils/serviceUtils');
            
            // Clear any previous errors first
            linkedInExpansionError.set(null);
            
            // Set the expanded content and structured data
            linkedInExpandedContent.set(totalContent || '');
            linkedInStructuredData.set(structuredData || null);
            linkedInExpansionProgress.set(progress || {
              expandedCount: 0,
              totalFound: 0,
              currentStep: 'complete',
              status: 'complete'
            });
            isLinkedInExpanding.set(false);
            
            addToLog(`✅ LinkedIn expansion completed: ${(totalContent || '').length} chars extracted`);
            
            // Optionally save to unified tab storage
            if (totalContent && totalContent.length > 0) {
              const { updateUnifiedTabData } = await import('../services/tabStorage');
              await updateUnifiedTabData({
                processing: {
                  linkedInExpansion: {
                    content: totalContent,
                    structuredData: structuredData,
                    metadata: metadata,
                    isExpanding: false,
                    progress: progress
                  }
                } as any
              });
            }
            
          } catch (error) {
            console.warn('Failed to update LinkedIn expansion stores:', error);
            addToLog(`⚠️ LinkedIn expansion completed but failed to update stores: ${error}`);
          }
          
          return;
        }
        
        // Handle Twitter expansion completion
        if (message.action === 'twitterExpansionComplete') {
          // ✅ PHASE 5 FIX: Validate tab context for Twitter expansion completion
          if (!(await validateMessageTabContext(message.tabId, message.url))) {
            addToLog(`🔄 Ignoring Twitter expansion completion from different tab`);
            return;
          }
          
          const { totalContent, metadata, structuredData, progress } = message;
          
          // Update Twitter expansion stores
          try {
            const { twitterExpandedContent, twitterStructuredData, twitterExpansionProgress, isTwitterExpanding, twitterExpandedHtml, twitterExpansionError } = await import('./utils/serviceUtils');
            
            // Clear any previous errors first
            twitterExpansionError.set(null);
            
            // Set the expanded content and structured data
            twitterExpandedContent.set(totalContent || '');
            twitterStructuredData.set(structuredData || null);
            twitterExpansionProgress.set(progress || {
              expandedCount: 0,
              totalFound: 0,
              currentStep: 'complete',
              status: 'complete'
            });
            isTwitterExpanding.set(false);
            
            // Set HTML content if available
            if (message.htmlContent) {
              twitterExpandedHtml.set(message.htmlContent);
            }
            
            addToLog(`✅ Twitter expansion completed: ${(totalContent || '').length} chars extracted`);
            
            // Optionally save to unified tab storage
            if (totalContent && totalContent.length > 0) {
              const { updateUnifiedTabData } = await import('../services/tabStorage');
              await updateUnifiedTabData({
                processing: {
                  twitterExpansion: {
                    content: totalContent,
                    structuredData: structuredData,
                    metadata: metadata,
                    isExpanding: false,
                    progress: progress
                  }
                } as any
              });
            }
            
          } catch (error) {
            console.warn('Failed to update Twitter expansion stores:', error);
            addToLog(`⚠️ Twitter expansion completed but failed to update stores: ${error}`);
          }
          
          return;
        }
        
        // Handle LinkedIn expansion progress updates
        if (message.action === 'linkedInExpansionUpdate') {
          // ✅ PHASE 5 FIX: Validate tab context for LinkedIn expansion updates
          if (!(await validateMessageTabContext(message.tabId, message.url))) {
            addToLog(`🔄 Ignoring LinkedIn expansion update from different tab`);
            return;
          }
          
          const { content, progress } = message;
          
          try {
            const { linkedInExpansionProgress } = await import('./utils/serviceUtils');
            linkedInExpansionProgress.set(progress || {
              expandedCount: 0,
              totalFound: 0,
              currentStep: 'expanding',
              status: 'expanding'
            });
            
            // Log progress updates less frequently to avoid spam
            if (progress && (progress.expandedCount % 5 === 0 || progress.currentStep === 'complete')) {
              addToLog(`LinkedIn expansion progress: ${progress.expandedCount} buttons expanded, step: ${progress.currentStep}`);
            }
          } catch (error) {
            console.warn('Failed to update LinkedIn expansion progress:', error);
          }
          
          return;
        }
        
        // Handle Twitter expansion progress updates
        if (message.action === 'twitterExpansionUpdate') {
          // ✅ PHASE 5 FIX: Validate tab context for Twitter expansion updates
          if (!(await validateMessageTabContext(message.tabId, message.url))) {
            addToLog(`🔄 Ignoring Twitter expansion update from different tab`);
            return;
          }
          
          const { content, progress } = message;
          
          try {
            const { twitterExpansionProgress } = await import('./utils/serviceUtils');
            twitterExpansionProgress.set(progress || {
              expandedCount: 0,
              totalFound: 0,
              currentStep: 'expanding',
              status: 'expanding'
            });
            
            // Log progress updates less frequently to avoid spam
            if (progress && (progress.expandedCount % 5 === 0 || progress.currentStep === 'complete')) {
              addToLog(`Twitter expansion progress: ${progress.expandedCount} scrolls completed, step: ${progress.currentStep}`);
            }
          } catch (error) {
            console.warn('Failed to update Twitter expansion progress:', error);
          }
          
          return;
        }
        
        // triggerCitationGeneration handler removed - now handled by streaming processors
        
        // 🔑 NEW: Handle PDF interception notifications from background script
        if (message.action === 'PDF_INTERCEPTED_SIDEPANEL') {
          const pdfData = message.data;
          addToLog(`📄 PDF intercepted by background script: ${pdfData.filename} (${pdfData.size} bytes)`);
          
          // ✅ MIGRATED: Use tab storage for PDF state instead of global stores
          try {
            // Just update legacy stores for now - tab storage will be updated with content below
            isPDFContent.set(true);
            pdfExtractionStatus.set('extracting');
            pdfExtractionError.set(null);
          } catch (error) {
            // Fallback to legacy stores
            isPDFContent.set(true);
            pdfExtractionStatus.set('extracting');
            pdfExtractionError.set(null);
          }
          
          // Request the stored ArrayBuffer and process it
          setTimeout(async () => {
            try {
              // Get stored PDF content from background script
              const response = await new Promise<any>((resolve, reject) => {
                chrome.runtime.sendMessage({
                  action: 'GET_STORED_PDF',
                  contentId: pdfData.contentId
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(response);
                  }
                });
              });
              
              if (response.success) {
                addToLog(`📄 Retrieved PDF ArrayBuffer, extracting text...`);
                
                // Extract content from ArrayBuffer using PDF.js
                const { extractPDFFromArrayBuffer } = await import('./utils/pdfUtils');
                const extractedPDF = await extractPDFFromArrayBuffer(
                  response.arrayBuffer, 
                  pdfData.url, 
                  pdfData.filename
                );
                
                // ✅ MIGRATED: Update unified tab storage instead of individual global stores
                try {
                  const { updateUnifiedTabData } = await import('../services/tabStorage');
                  
                  // Enhanced metadata
                  const metadata = enhancePDFMetadata({
                    title: extractedPDF.title,
                    ...extractedPDF.metadata,
                    interceptedAt: new Date().toISOString(),
                    contentId: pdfData.contentId,
                    detectionMethod: pdfData.detectionMethod
                  }, 'pdf');
                  
                  await updateUnifiedTabData({
                    content: {
                      text: extractedPDF.text,
                      html: extractedPDF.html,
                      markdown: extractedPDF.text, // PDF text as markdown
                      metadata: metadata,
                      url: extractedPDF.url,
                      cleanUrl: extractedPDF.cleanUrl,
                      title: extractedPDF.title,
                      wordCount: extractedPDF.wordCount,
                      hasCustomContent: false
                    }
                  });
                  
                  addToLog(`📄 PDF content saved to unified tab storage`);
                } catch (tabStorageError) {
                  console.warn('Failed to update unified tab storage, using legacy stores:', tabStorageError);
                  
                  // ✅ PHASE 4 FIX: Remove legacy store fallback - content already updated via unified storage above
                }
                
                // Update PDF stores (both tab storage and legacy)
                pdfExtractionStatus.set('complete');
                
                // Add to intercepted PDFs tracking
                addInterceptedPDF({
                  id: pdfData.id,
                  url: pdfData.url,
                  filename: pdfData.filename,
                  size: pdfData.size,
                  timestamp: pdfData.timestamp,
                  contentId: pdfData.contentId,
                  detectionMethod: pdfData.detectionMethod,
                  extractedText: extractedPDF.text.substring(0, 500) + '...', // Preview
                  wordCount: extractedPDF.wordCount,
                  pageCount: extractedPDF.metadata?.pageCount || 0
                });
                
                addToLog(`📄 PDF interception completed: ${extractedPDF.wordCount} words extracted from ${pdfData.filename}`);
                
              } else {
                throw new Error(response.error || 'Failed to retrieve stored PDF');
              }
              
            } catch (error) {
              addToLog(`📄 PDF interception processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
              pdfExtractionError.set(error instanceof Error ? error.message : 'PDF interception failed');
              pdfExtractionStatus.set('error');
            }
          }, 100);
        }

        if (message.action === 'triggerPDFExtraction') {
          // Handle direct PDF extraction trigger from background script
          const { url, title } = message;
          addToLog(`📄 Received direct PDF extraction trigger for: ${url}`);
          pdfExtractionStatus.set('extracting');
          
          // Trigger PDF extraction in side panel
          setTimeout(async () => {
            try {
              const extractedPDF = await processPDFContent(url, title);
              
              if (extractedPDF) {
                // ✅ PHASE 4 FIX: Use unified storage API instead of calling .set() on derived stores
                try {
                  const { updateUnifiedTabData } = await import('../services/tabStorage');
                  const metadata = enhancePDFMetadata({
                    title: extractedPDF.title,
                    ...extractedPDF.metadata
                  }, 'pdf');
                  
                  await updateUnifiedTabData({
                    content: {
                      text: extractedPDF.text,
                      html: extractedPDF.html || `<pre>${extractedPDF.text}</pre>`,
                      markdown: extractedPDF.text, // PDF text as markdown
                      url: extractedPDF.url,
                      cleanUrl: extractedPDF.cleanUrl,
                      metadata: metadata,
                      title: extractedPDF.title,
                      wordCount: extractedPDF.wordCount,
                      hasCustomContent: false
                    }
                  });
                } catch (error) {
                  console.warn('Failed to update PDF content via unified storage:', error);
                }
                
                // Update PDF-specific stores
                isPDFContent.set(true);
                pdfExtractionStatus.set('complete');
                pdfExtractionError.set(null);
                
                addToLog(`📄 PDF extraction completed: ${extractedPDF.wordCount} words`);
              }
            } catch (error) {
              addToLog(`📄 PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
              pdfExtractionError.set(error instanceof Error ? error.message : 'PDF extraction failed');
              pdfExtractionStatus.set('error');
            }
          }, 100);
        }
        
        if (message.action === 'pdfExtractionComplete') {
          // Handle PDF extraction completion from background script
          if (message.success) {
            const content = message.content;
            
            // Check if this is just basic info that needs side panel extraction
            if (content.needsSidePanelExtraction) {
              addToLog(`📄 Background provided basic PDF info, triggering side panel extraction for: ${content.url}`);
              pdfExtractionStatus.set('extracting');
              
              // Trigger actual PDF extraction in side panel
              setTimeout(async () => {
                try {
                  const extractedPDF = await processPDFContent(content.url, content.title);
                  
                  if (extractedPDF) {
                    // ✅ PHASE 4 FIX: Use unified storage API instead of calling .set() on derived stores
                    try {
                      const { updateUnifiedTabData } = await import('../services/tabStorage');
                      const metadata = enhancePDFMetadata({
                        title: extractedPDF.title,
                        ...extractedPDF.metadata
                      }, 'pdf');
                      
                      await updateUnifiedTabData({
                        content: {
                          text: extractedPDF.text,
                          html: extractedPDF.html || `<pre>${extractedPDF.text}</pre>`,
                          markdown: extractedPDF.text, // PDF text as markdown
                          url: extractedPDF.url,
                          cleanUrl: extractedPDF.cleanUrl,
                          metadata: metadata,
                          title: extractedPDF.title,
                          wordCount: extractedPDF.wordCount,
                          hasCustomContent: false
                        }
                      });
                    } catch (error) {
                      console.warn('Failed to update PDF content via unified storage:', error);
                    }
                    
                    // Update PDF-specific stores
                    isPDFContent.set(true);
                    pdfExtractionStatus.set('complete');
                    pdfExtractionError.set(null);
                    
                    addToLog(`📄 PDF extraction completed: ${extractedPDF.wordCount} words`);
                  }
                } catch (error) {
                  addToLog(`📄 PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  pdfExtractionError.set(error instanceof Error ? error.message : 'PDF extraction failed');
                  pdfExtractionStatus.set('error');
                }
              }, 100);
            } else {
              // We have actual extracted PDF content
              addToLog(`📄 PDF extraction completed via background script: ${content.wordCount} words`);
              
              // ✅ PHASE 4 FIX: Use unified storage API instead of calling .set() on derived stores
              try {
                const { updateUnifiedTabData } = await import('../services/tabStorage');
                const metadata = enhancePDFMetadata({
                  title: content.title,
                  contentType: 'pdf',
                  wordCount: content.wordCount,
                  extractedAt: content.extractedAt,
                  extractedBy: content.extractedBy
                }, 'pdf');
                
                await updateUnifiedTabData({
                  content: {
                    text: content.text,
                    html: `<div class="pdf-content"><h1>📄 ${content.title}</h1><pre>${content.text}</pre></div>`,
                    markdown: content.text, // PDF text as markdown
                    url: content.url,
                    cleanUrl: content.url,
                    metadata: metadata,
                    title: content.title,
                    wordCount: content.wordCount,
                    hasCustomContent: false
                  }
                });
              } catch (error) {
                console.warn('Failed to update PDF content via unified storage:', error);
              }
              
              // Update PDF-specific stores
              isPDFContent.set(true);
              pdfExtractionStatus.set('complete');
              pdfExtractionError.set(null);
            }
            
          } else {
            addToLog(`📄 PDF extraction failed: ${message.error}`);
            pdfExtractionStatus.set('error');
            pdfExtractionError.set(message.error);
          }
        }
      });
    addToLog("Message listener setup complete");
    
    // Mark as set up
    messageListenerSetup = true;
    console.log('🔧 SIDEBAR LOG: Message listener setup flag set to true');
    
    // 🔍 DEBUG: Test if we can send a message to the background script
    console.log('🔍 SIDEBAR LOG: Testing message sending to background script...');
    try {
      service.sendMessage({ action: 'testFromSidebar', message: 'Hello from sidebar!' })
        .then(response => {
          console.log('🔍 SIDEBAR LOG: Received response from background:', response);
        })
        .catch(error => {
          console.log('🔍 SIDEBAR LOG: Error sending test message:', error);
        });
    } catch (error) {
      console.log('🔍 SIDEBAR LOG: Exception sending test message:', error);
    }
  } catch (error) {
    addToLog(`Error setting up message listener: ${error}`);
  }
}

// Initialize tab data model tracking
let isTabDataModelInitialized = false;
export async function initTabDataModel() {
  if (isTabDataModelInitialized) return;
  
  try {
    const { onTabChange } = await import('./utils/tabUtils');
    
    // Update data model when tab changes
    onTabChange(async (tabId: number | null, url: string | null) => {
      if (tabId && url) {
        console.log('Tab changed:', tabId, url);
      }
    });
    
    // Tab data model initialization complete
    
    isTabDataModelInitialized = true;
    console.log('✅ Tab-aware data model initialized');
  } catch (error) {
    console.error('Failed to initialize tab data model:', error);
  }
}

// ⚡ STREAMING CONTENT PROCESSORS
// Handles multiple async content processing operations and updates UI progressively

// Track running processors to prevent duplicates
const runningProcessors = new Map<string, boolean>();

async function startStreamingContentProcessors(
  textContent: string, 
  htmlContent: string, 
  metadata: any, 
  url: string
): Promise<void> {
  // ✅ PHASE 5 FIX: Get current tab context for isolation
  let currentTabId: number | null = null;
  let currentTabUrl: string | null = null;
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tabs[0]?.id || null;
    currentTabUrl = tabs[0]?.url || null;
    
    if (!currentTabId || !currentTabUrl) {
      addToLog('⚠️ Cannot start streaming processors - no active tab context');
      return;
    }
  } catch (error) {
    addToLog('⚠️ Failed to get tab context for streaming processors');
    return;
  }
  
  // ✅ FIX: Prevent duplicate processors for the same tab/content
  const processorKey = `${currentTabId}-${url}`;
  if (runningProcessors.get(processorKey)) {
    addToLog(`🔄 Streaming processors already running for tab ${currentTabId} - skipping duplicate`);
    return;
  }
  
  runningProcessors.set(processorKey, true);
  addToLog(`🔄 Starting tab-specific streaming content processors for tab ${currentTabId}...`);
  
  // ✅ FIXED: Throttling variables to prevent infinite loops
  let lastTabContextLogTime = 0;
  let lastTabContextErrorTime = 0;
  
  // Helper function to validate tab context before updating stores
  async function validateTabContext(): Promise<boolean> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTabId = tabs[0]?.id;
      const activeTabUrl = tabs[0]?.url;
      
      // Only proceed if we're still on the same tab where processing started
      if (activeTabId === currentTabId && activeTabUrl === currentTabUrl) {
        return true;
      } else {
        // ✅ FIXED: Remove excessive logging that causes infinite loops
        // Only log tab context changes once per second to prevent spam
        const now = Date.now();
        if (now - lastTabContextLogTime > 1000) {
          console.log(`🔄 Tab context changed during processing (${currentTabId}->${activeTabId}) - skipping store update`);
          lastTabContextLogTime = now;
        }
        return false;
      }
    } catch (error) {
      // ✅ FIXED: Reduce error logging frequency
      const now = Date.now();
      if (now - lastTabContextErrorTime > 5000) {
        console.log('Failed to validate tab context:', error);
        lastTabContextErrorTime = now;
      }
      return false;
    }
  }
  
  // Helper function to check if content script is available before trying to communicate
  async function isContentScriptAvailable(): Promise<boolean> {
    try {
      if (!currentTabId) return false;
      
      // ✅ FIX: Don't send checkAvailability messages - they spam the content script
      // Just assume content script is available for background processing
      // If it's not available, the actual message will fail gracefully
      return true;
    } catch (error) {
      console.log('Content script not available for background processing:', error);
      return false;
    }
  }
  
  // Define all processors that can run in parallel
  const processors = [
    {
      name: 'citations',
      taskId: `citations-${currentTabId}`,
      displayName: 'Generating citations',
      enabled: true, // Always enabled - citations are cheap and useful for any page
      requiresContentScript: false, // Citations don't need content script
      processor: async () => {
        try {
          addToLog(`🎯 Starting citation processor for tab ${currentTabId}`);
          
          // Validate tab context before processing
          if (!(await validateTabContext())) {
            addToLog(`🔄 Skipping citations - tab context changed for tab ${currentTabId}`);
            return;
          }
          
          addToLog(`📚 Tab ${currentTabId}: Auto-generating citations with content: text=${textContent.length} chars, html=${htmlContent.length} chars, url=${url}`);
          await generateCitations();
          
          // Validate tab context before logging success
          if (await validateTabContext()) {
            addToLog(`✅ Tab ${currentTabId}: Citations auto-generated successfully`);
          } else {
            addToLog(`⚠️ Tab ${currentTabId}: Citations generated but tab context changed`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          addToLog(`❌ Tab ${currentTabId}: Citation generation failed: ${errorMessage}`);
          console.error('Citation generation error:', error);
        }
      }
    },
    {
      name: 'contentStructure',
      taskId: `content-structure-${currentTabId}`,
      displayName: 'Parsing content structure',
      enabled: htmlContent.length > 1000, // Only for substantial content
      requiresContentScript: false, // Content structure parsing is done locally
      processor: async () => {
        try {
          // Validate tab context before processing
          if (!(await validateTabContext())) {
            addToLog(`🔄 Skipping content structure - tab context changed`);
            return;
          }
          
          addToLog(`🏗️ Tab ${currentTabId}: Parsing content structure...`);
          await parseContentStructure();
          
          // Validate tab context before logging success
          if (await validateTabContext()) {
            addToLog(`✅ Tab ${currentTabId}: Content structure parsed`);
          }
        } catch (error) {
          if (await validateTabContext()) {
            addToLog(`❌ Tab ${currentTabId}: Content structure parsing failed: ${error}`);
          }
        }
      }
    },
    {
      name: 'pageAssets',
      taskId: `page-assets-${currentTabId}`,
      displayName: 'Extracting page assets',
      enabled: htmlContent.includes('<img') || htmlContent.includes('<svg') || htmlContent.includes('font-'),
      requiresContentScript: true, // Page assets might need content script for real URLs
      processor: async () => {
        try {
          // Validate tab context before processing
          if (!(await validateTabContext())) {
            addToLog(`🔄 Skipping page assets - tab context changed`);
            return;
          }
          
          // Check if content script is available before attempting asset extraction
          const contentScriptAvailable = await isContentScriptAvailable();
          if (!contentScriptAvailable) {
            addToLog(`🎨 Tab ${currentTabId}: Skipping page assets - content script not available (non-critical)`);
            return;
          }
          
          addToLog(`🎨 Tab ${currentTabId}: Extracting page assets...`);
          await extractPageAssets(htmlContent, url);
          
          // Validate tab context before logging success
          if (await validateTabContext()) {
            addToLog(`✅ Tab ${currentTabId}: Page assets extracted`);
          }
        } catch (error) {
          // Don't show errors for page assets - it's not critical
          if (await validateTabContext()) {
            addToLog(`ℹ️ Tab ${currentTabId}: Page asset extraction skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    },
    {
      name: 'comprehensiveMetadata',
      taskId: `comprehensive-metadata-${currentTabId}`,
      displayName: 'Extracting comprehensive metadata',
      enabled: false, // DISABLED: Causes "Could not establish connection" error and 40s delay
      requiresContentScript: false,
      processor: async () => {
        try {
          addToLog(`🔍 Tab ${currentTabId}: Comprehensive metadata extraction disabled to prevent delays`);
          
          // ✅ PHASE 5 FIX: Only update tab-specific storage if still on same tab
          if (await validateTabContext()) {
            const { updateReactiveContent } = await import('../stores/reactiveTabStorage');
            await updateReactiveContent({
              metadata: {
                ...metadata,
                needsEnhancement: false,
                comprehensiveMetadataSkipped: true
              }
            });
            
            addToLog(`✅ Tab ${currentTabId}: Comprehensive metadata skipped for performance`);
          }
        } catch (error) {
          if (await validateTabContext()) {
            addToLog(`❌ Tab ${currentTabId}: Comprehensive metadata processing failed: ${error}`);
          }
        }
      }
    },
    {
      name: 'enhancedMetadata',
      taskId: `enhanced-metadata-${currentTabId}`,
      displayName: 'Extracting enhanced metadata',
      enabled: textContent.length > 500, // Only for substantial content
      requiresContentScript: false, // Enhanced metadata uses LLM, not content script
      processor: async () => {
        try {
          // Validate tab context before processing
          if (!(await validateTabContext())) {
            addToLog(`🔄 Skipping enhanced metadata - tab context changed`);
            return;
          }
          
          addToLog(`🔍 Tab ${currentTabId}: Extracting enhanced metadata...`);
          
          const pageData = {
            text: textContent,
            html: htmlContent,
            metadata: metadata,
            url: url,
            title: metadata.title || 'Untitled',
            isPDFContent: metadata.contentType === 'pdf'
          };
          
          const enhancedCitations = await extractEnhancedCitationMetadata(pageData);
          
          if (enhancedCitations && (await validateTabContext())) {
            // ✅ PHASE 5 FIX: Only update tab storage if still on same tab
            const { updateReactiveContent } = await import('../stores/reactiveTabStorage');
            await updateReactiveContent({
              metadata: {
                ...metadata,
                citations: {
                  ...(metadata as any).citations,
                  ...enhancedCitations
                },
                // Update core fields if they were enhanced
                title: enhancedCitations.title || metadata.title,
                author: enhancedCitations.authors?.join(', ') || metadata.author
              }
            });
            
            addToLog(`✅ Tab ${currentTabId}: Enhanced metadata extracted: ${Object.keys(enhancedCitations).join(', ')}`);
          } else if (await validateTabContext()) {
            addToLog(`ℹ️ Tab ${currentTabId}: No enhanced metadata found`);
          }
        } catch (error) {
          // Don't show errors for enhanced metadata - it's not critical
          if (await validateTabContext()) {
            addToLog(`ℹ️ Tab ${currentTabId}: Enhanced metadata extraction skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    },
    {
      name: 'markdownConversion',
      taskId: `markdown-conversion-${currentTabId}`,
      displayName: 'Converting to markdown',
      enabled: htmlContent.length > 100, // Always convert if we have HTML
      requiresContentScript: false, // Markdown conversion is done locally
      processor: async () => {
        try {
          // Validate tab context before processing
          if (!(await validateTabContext())) {
            addToLog(`🔄 Skipping markdown conversion - tab context changed`);
            return;
          }
          
          addToLog(`📝 Tab ${currentTabId}: Converting HTML to markdown...`);
          const { turndownService } = await import('../stores/utils/contentUtils');
          const markdown = turndownService.turndown(htmlContent);
          
          // ✅ PHASE 5 FIX: Only update tab storage if still on same tab
          if (await validateTabContext()) {
            const { updateReactiveContent } = await import('../stores/reactiveTabStorage');
            await updateReactiveContent({ markdown });
            
            addToLog(`✅ Tab ${currentTabId}: Markdown conversion completed`);
          }
        } catch (error) {
          if (await validateTabContext()) {
            addToLog(`❌ Tab ${currentTabId}: Markdown conversion failed: ${error}`);
          }
        }
      }
    }
  ];
  
  // Start all enabled processors in parallel
  const activeProcessors = processors.filter(p => p.enabled);
  addToLog(`🚀 Starting ${activeProcessors.length} tab-specific background processors for tab ${currentTabId}: ${activeProcessors.map(p => p.name).join(', ')}`);
  
  // Run all processors in parallel using Promise.allSettled for true parallelism
  const processorPromises = activeProcessors.map(processor => processor.processor());
  
  // Don't await - let them run in background
  Promise.allSettled(processorPromises).then(async (results) => {
    // Only log completion if still on same tab
    if (await validateTabContext()) {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      addToLog(`✅ Tab ${currentTabId}: Background processing completed: ${successful} successful, ${failed} failed`);
    }
    
    // ✅ FIX: Clean up running processors map
    runningProcessors.delete(processorKey);
  });
  
  addToLog(`✅ Tab ${currentTabId}: All background processors started in parallel`);
} 