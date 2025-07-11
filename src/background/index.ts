// Simplified background script - no global state, no broadcasting
// Each side panel instance is isolated and handles its own tab

const PANEL_PATH = 'index.html';

import { handleContentExtraction } from './tasks/handleContentExtraction.svelte';
import { handleManualContentSetting } from './tasks/handleManualContentSetting.svelte';
import { handleBookmarking, getBookmarkStatus } from './tasks/handleBookmarking.svelte';
import { handleSummaryGeneration, getSummaryStatus } from './tasks/handleSummaryGeneration.svelte';
import { handleResearchPaperExtraction, handleQuickResearchPaperExtraction, handleSingleSectionExtraction, getResearchPaperStatus } from './tasks/handleResearchPaperExtraction.svelte';
import { handleContentStructureParsing, getContentStructureStatus } from './tasks/handleContentStructureParsing.svelte';
import { handleChatMessage, handleClearChatHistory, getChatStatus } from './tasks/handleChatMessage.svelte';
import { handleThreadgirlProcessing, getThreadgirlStatus } from './tasks/handleThreadgirlProcessing.svelte';
import { handlePageAssetsExtraction, getPageAssetsStatus } from './tasks/handlePageAssetsExtraction.svelte';
import { handleJinaPageshot, handleJinaScreenshot, getScreenshotStatus } from './tasks/handleJinaScreenshots.svelte';
import { handleRecipeExtraction, getRecipeStatus } from './tasks/handleRecipeExtraction.svelte';
import { handleLinkedInThreadExtractionWithScroll, getLinkedInThreadStatus } from './tasks/handleLinkedInThreadExtraction.svelte';
import { handleTwitterThreadExtractionWithScroll, getTwitterThreadStatus } from './tasks/handleTwitterThreadExtraction.svelte';
import { handlePDFExtraction, getPDFExtractionStatus, generateCitations } from './tasks/handlePDFExtraction.svelte';
import { handleTextToSpeechGeneration, handleTtsTextGeneration, handleTtsAudioGeneration, getTtsStatus } from './tasks/handleTextToSpeechGeneration.svelte';
import { DataController } from '../lib/services/dataController.svelte';

// Shared data controller instance for background context
export const backgroundDataController = new DataController('background');


// Handle content extraction requests (from side panels)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔧 Background received message:', message);

  // Handle content extraction requests
  if (message.action === 'extractContentForCurrentTab') {
    const { tabId } = message;
    handleContentExtraction(tabId, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle manual content setting
  if (message.action === 'setManualContent') {
    const { url, data } = message;
    handleManualContentSetting(url, data, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle bookmarking requests
  if (message.action === 'bookmarkContent') {
    const { url } = message;
    handleBookmarking(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle bookmark status requests
  if (message.action === 'getBookmarkStatus') {
    const { url } = message;
    getBookmarkStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle summary generation requests
  if (message.action === 'generateSummary') {
    const { url } = message;
    handleSummaryGeneration(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle summary status requests
  if (message.action === 'getSummaryStatus') {
    const { url } = message;
    getSummaryStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle research paper extraction requests
  if (message.action === 'extractResearchPaper') {
    const { url, userBackground } = message;
    handleResearchPaperExtraction(url, userBackground, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle quick research paper extraction requests
  if (message.action === 'extractResearchPaperQuick') {
    const { url, userBackground } = message;
    handleQuickResearchPaperExtraction(url, userBackground, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle research paper status requests
  if (message.action === 'getResearchPaperStatus') {
    const { url } = message;
    getResearchPaperStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle single section extraction requests
  if (message.action === 'extractSingleSection') {
    const { url, sectionName, userBackground } = message;
    handleSingleSectionExtraction(url, sectionName, userBackground, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle content structure parsing requests
  if (message.action === 'parseContentStructure') {
    const { url } = message;
    handleContentStructureParsing(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle content structure status requests
  if (message.action === 'getContentStructureStatus') {
    const { url } = message;
    getContentStructureStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle chat message requests
  if (message.action === 'sendChatMessage') {
    const { url, message: chatMessage, chatHistory, customSystemPrompt } = message;
    handleChatMessage(url, chatMessage, chatHistory, sendResponse, customSystemPrompt);
    return true; // Keep message channel open for async response
  }

  // Handle clear chat history requests
  if (message.action === 'clearChatHistory') {
    const { url } = message;
    handleClearChatHistory(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle chat status requests
  if (message.action === 'getChatStatus') {
    const { url } = message;
    getChatStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle Threadgirl processing requests
  if (message.action === 'processWithThreadgirl') {
    const { url, prompt, model } = message;
    handleThreadgirlProcessing(url, prompt, model, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle Threadgirl status requests
  if (message.action === 'getThreadgirlStatus') {
    const { url } = message;
    getThreadgirlStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle page assets extraction requests
  if (message.action === 'extractPageAssets') {
    const { url } = message;
    handlePageAssetsExtraction(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle page assets status requests
  if (message.action === 'getPageAssetsStatus') {
    const { url } = message;
    getPageAssetsStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle Jina pageshot requests
  if (message.action === 'generatePageshot') {
    const { url } = message;
    handleJinaPageshot(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle Jina screenshot requests
  if (message.action === 'generateScreenshot') {
    const { url } = message;
    handleJinaScreenshot(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle screenshot status requests
  if (message.action === 'getScreenshotStatus') {
    const { url } = message;
    getScreenshotStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle recipe extraction requests
  if (message.action === 'extractRecipe') {
    const { url } = message;
    handleRecipeExtraction(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle recipe status requests
  if (message.action === 'getRecipeStatus') {
    const { url } = message;
    getRecipeStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle Twitter thread extraction with automatic scrolling
  if (message.action === 'extractTwitterThreadWithScroll') {
    const { url, maxScrolls, scrollDelay } = message;
    handleTwitterThreadExtractionWithScroll(url, maxScrolls, scrollDelay, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle Twitter thread status requests
  if (message.action === 'getTwitterThreadStatus') {
    const { url } = message;
    getTwitterThreadStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle LinkedIn thread extraction with automatic scrolling and expansion
  if (message.action === 'extractLinkedInThreadWithScroll') {
    const { url, maxScrolls, scrollDelay, maxExpansions } = message;
    handleLinkedInThreadExtractionWithScroll(url, maxScrolls, scrollDelay, maxExpansions, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle LinkedIn thread status requests
  if (message.action === 'getLinkedInThreadStatus') {
    const { url } = message;
    getLinkedInThreadStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle PDF extraction requests
  if (message.action === 'extractPDF') {
    const { url } = message;
    handlePDFExtraction(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle PDF extraction status requests
  if (message.action === 'getPDFExtractionStatus') {
    const { url } = message;
    getPDFExtractionStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle citation generation requests (unified for PDF and regular content)
  if (message.action === 'generateCitations') {
    const { url } = message;
    generateCitations(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle PDF citation generation requests (legacy support)
  if (message.action === 'generatePDFCitations') {
    const { url } = message;
    generateCitations(url, sendResponse); // Use the unified handler
    return true; // Keep message channel open for async response
  }

  // Handle text-to-speech generation requests (legacy - full pipeline)
  if (message.action === 'generateTextToSpeech') {
    const { url, voice } = message;
    handleTextToSpeechGeneration(url, voice, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle TTS text generation requests (Step 1)
  if (message.action === 'generateTtsText') {
    const { url } = message;
    handleTtsTextGeneration(url, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle TTS audio generation requests (Step 2)
  if (message.action === 'generateTtsAudio') {
    const { text, voice } = message;
    handleTtsAudioGeneration(text, voice, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Handle TTS status requests
  if (message.action === 'getTtsStatus') {
    const { url } = message;
    getTtsStatus(url).then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle extraction progress updates (from content scripts)
  if (message.action === 'updateExtractionProgress') {
    const { progress } = message;
    console.log('📊 Extraction progress update:', progress);
    // For now, just log the progress. In the future, this could be used to 
    // update UI elements or send to specific side panels
    sendResponse({ success: true });
    return true; // Keep message channel open for async response
  }

  // Handle load data requests (for refreshing without re-extraction)
  if (message.action === 'loadData') {
    const { url } = message;
    backgroundDataController.loadData(url).then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle get all tab data requests (for copying all storage data)
  if (message.action === 'getAllTabData') {
    (async () => {
      console.log('🔧 Entering getAllTabData handler');
      try {
        console.log('🔧 Fetching all storage data...');
        // Get all data from chrome.storage.local
        const allStorageData = await chrome.storage.local.get(null);
        console.log('🔧 Received storage data:', Object.keys(allStorageData).length, 'items');
        
        // Separate tab data from settings
        const tabData: Record<string, any> = {};
        const settingsData: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(allStorageData)) {
          if (key.startsWith('tabdata_')) {
            // Extract the URL from the key and use it as the key
            const url = key.replace('tabdata_', '');
            tabData[url] = value;
          } else if (key.startsWith('sidenote_')) {
            // Keep settings data
            settingsData[key] = value;
          } else {
            // Other data (might be from other extensions or legacy data)
            settingsData[key] = value;
          }
        }
        
        console.log('🔧 Processed data:', {
          totalTabs: Object.keys(tabData).length,
          totalSettings: Object.keys(settingsData).length
        });
        
        console.log('🔧 Sending response...');
        sendResponse({ 
          success: true, 
          data: {
            tabData,
            settingsData,
            totalTabs: Object.keys(tabData).length,
            totalSettings: Object.keys(settingsData).length
          }
        });
      } catch (error) {
        console.error('🔧 Error in getAllTabData:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();
    return true; // Keep message channel open for async response
  }

  // Handle raw storage data requests (for debugging/raw export)
  if (message.action === 'getRawStorageData') {
    (async () => {
      console.log('🔧 Entering getRawStorageData handler');
      try {
        console.log('🔧 Fetching raw storage data...');
        // Get all data from chrome.storage.local - no processing
        const allStorageData = await chrome.storage.local.get(null);
        console.log('🔧 Raw storage data:', Object.keys(allStorageData).length, 'items');
        
        console.log('🔧 Sending raw response...');
        sendResponse({ 
          success: true, 
          data: allStorageData,
          totalItems: Object.keys(allStorageData).length
        });
      } catch (error) {
        console.error('🔧 Error in getRawStorageData:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();
    return true; // Keep message channel open for async response
  }

  // Data controller messages are handled automatically by the controller instance
  // No need to handle them explicitly here

  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});



// Enable side panel for a specific tab
async function enablePanelForTab(tabId: number) {
  try {
    await chrome.sidePanel.setOptions({ 
      tabId, 
      path: PANEL_PATH, 
      enabled: true 
    });
    console.log('📌 Side panel enabled for tab:', tabId);
  } catch (error) {
    console.error('Failed to enable panel for tab', tabId, ':', error);
  }
}

// Enable side panel for all existing tabs on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extension installed, enabling panels for all tabs');
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        enablePanelForTab(tab.id);
      }
    });
  });
});

// Enable side panel for new tabs
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id) {
    console.log('📌 New tab created:', tab.id);
    enablePanelForTab(tab.id);
  }
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  console.log('🔧 Extension icon clicked for tab:', tab.id);
  
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
    
    // Notify content script that sidebar opened (for any cleanup if needed)
    chrome.tabs.sendMessage(tab.id, { action: 'sidebarOpened' }).catch(() => {
      // Content script might not be ready yet
    });
  }
});
