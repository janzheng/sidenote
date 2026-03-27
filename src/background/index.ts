// Background service worker — message dispatch + side panel lifecycle

const PANEL_PATH = 'index.html';

import { handleContentExtraction } from './tasks/handleContentExtraction.svelte';
import { handleManualContentSetting } from './tasks/handleManualContentSetting.svelte';
import { handleBookmarking, getBookmarkStatus } from './tasks/handleBookmarking.svelte';
import { handleSummaryGeneration, getSummaryStatus } from './tasks/handleSummaryGeneration.svelte';
import { handleResearchPaperExtraction, handleQuickResearchPaperExtraction, handleSingleSectionExtraction, getResearchPaperStatus } from './tasks/handleResearchPaperExtraction.svelte';
import { handleContentStructureParsing, getContentStructureStatus } from './tasks/handleContentStructureParsing.svelte';
import { handleChatMessage, handleClearChatHistory, getChatStatus } from './tasks/handleChatMessage.svelte';
import { handleThreadgirlProcessing, getThreadgirlStatus, handleClearThreadgirlResults, handleRemoveThreadgirlResult } from './tasks/handleThreadgirlProcessing.svelte';
import { handlePageAssetsExtraction, getPageAssetsStatus } from './tasks/handlePageAssetsExtraction.svelte';
import { handleJinaPageshot, handleJinaScreenshot, getScreenshotStatus } from './tasks/handleJinaScreenshots.svelte';
import { handleRecipeExtraction, getRecipeStatus } from './tasks/handleRecipeExtraction.svelte';
import { handleLinkedInThreadExtractionWithScroll, getLinkedInThreadStatus } from './tasks/handleLinkedInThreadExtraction.svelte';
import { handleTwitterThreadExtractionWithScroll, getTwitterThreadStatus } from './tasks/handleTwitterThreadExtraction.svelte';
import { handleRedditThreadExtraction, getRedditThreadStatus } from './tasks/handleRedditThreadExtraction';
import { handlePDFExtraction, getPDFExtractionStatus, generateCitations } from './tasks/handlePDFExtraction.svelte';
import { handleTextToSpeechGeneration, handleTtsTextGeneration, handleTtsAudioGeneration, getTtsStatus } from './tasks/handleTextToSpeechGeneration.svelte';
import { handleMapsExtraction, getMapsDataStatus } from './tasks/handleMapsExtraction.svelte';
import { handleMapsControl, getMapsControlStatus } from './tasks/handleMapsControl.svelte';
import { DataController } from '../lib/services/dataController.svelte';

// Shared data controller instance for background context
export const backgroundDataController = new DataController('background');

// ---------------------------------------------------------------------------
// Helper: wraps a status-getter (url → Promise<status>) into a handler
// ---------------------------------------------------------------------------
type SendResponse = (response: any) => void;
type Handler = (msg: any, send: SendResponse) => void | Promise<void>;

function statusHandler(getter: (url: string) => Promise<any>): Handler {
  return async (msg, send) => {
    try {
      const status = await getter(msg.url);
      send({ success: true, status });
    } catch (err) {
      console.error('statusHandler getter error:', err);
      send({ success: false, error: err instanceof Error ? err.message : 'Status fetch failed' });
    }
  };
}

// ---------------------------------------------------------------------------
// Dispatch map: action name → handler
// ---------------------------------------------------------------------------
const handlers: Record<string, Handler> = {
  // Content extraction
  extractContentForCurrentTab: (msg, send) => handleContentExtraction(msg.tabId, send),
  setManualContent: (msg, send) => handleManualContentSetting(msg.url, msg.data, send),

  // Bookmarks
  bookmarkContent: (msg, send) => handleBookmarking(msg.url, send),
  getBookmarkStatus: statusHandler(getBookmarkStatus),

  // Summaries
  generateSummary: (msg, send) => handleSummaryGeneration(msg.url, send),
  getSummaryStatus: statusHandler(getSummaryStatus),

  // Research papers
  extractResearchPaper: (msg, send) => handleResearchPaperExtraction(msg.url, msg.userBackground, send),
  extractResearchPaperQuick: (msg, send) => handleQuickResearchPaperExtraction(msg.url, msg.userBackground, send),
  getResearchPaperStatus: statusHandler(getResearchPaperStatus),
  extractSingleSection: (msg, send) => handleSingleSectionExtraction(msg.url, msg.sectionName, msg.userBackground, send),

  // Content structure
  parseContentStructure: (msg, send) => handleContentStructureParsing(msg.url, send),
  getContentStructureStatus: statusHandler(getContentStructureStatus),

  // Chat
  sendChatMessage: (msg, send) => handleChatMessage(msg.url, msg.message, msg.chatHistory, send, msg.customSystemPrompt),
  clearChatHistory: (msg, send) => handleClearChatHistory(msg.url, send),
  getChatStatus: statusHandler(getChatStatus),

  // Threadgirl
  processWithThreadgirl: (msg, send) => handleThreadgirlProcessing(msg.url, msg.prompt, msg.model, send),
  getThreadgirlStatus: statusHandler(getThreadgirlStatus),
  clearThreadgirlResults: (msg, send) => handleClearThreadgirlResults(msg.url, send),
  removeThreadgirlResult: (msg, send) => handleRemoveThreadgirlResult(msg.url, msg.resultId, send),

  // Page assets
  extractPageAssets: (msg, send) => handlePageAssetsExtraction(msg.url, send),
  getPageAssetsStatus: statusHandler(getPageAssetsStatus),

  // Screenshots
  generatePageshot: (msg, send) => handleJinaPageshot(msg.url, send),
  generateScreenshot: (msg, send) => handleJinaScreenshot(msg.url, send),
  getScreenshotStatus: statusHandler(getScreenshotStatus),

  // Recipes
  extractRecipe: (msg, send) => handleRecipeExtraction(msg.url, send),
  getRecipeStatus: statusHandler(getRecipeStatus),

  // Twitter
  extractTwitterThreadWithScroll: (msg, send) => handleTwitterThreadExtractionWithScroll(msg.url, msg.maxScrolls, msg.scrollDelay, send),
  getTwitterThreadStatus: statusHandler(getTwitterThreadStatus),

  // LinkedIn
  extractLinkedInThreadWithScroll: (msg, send) => handleLinkedInThreadExtractionWithScroll(msg.url, msg.maxScrolls, msg.scrollDelay, msg.maxExpansions, send),
  getLinkedInThreadStatus: statusHandler(getLinkedInThreadStatus),

  // Reddit
  extractRedditThread: (msg, send) => handleRedditThreadExtraction(msg.url, send),
  getRedditThreadStatus: statusHandler(getRedditThreadStatus),

  // PDF & citations
  extractPDF: (msg, send) => handlePDFExtraction(msg.url, send),
  getPDFExtractionStatus: statusHandler(getPDFExtractionStatus),
  generateCitations: (msg, send) => generateCitations(msg.url, send),
  generatePDFCitations: (msg, send) => generateCitations(msg.url, send), // legacy alias

  // Text-to-speech
  generateTextToSpeech: (msg, send) => handleTextToSpeechGeneration(msg.url, msg.voice, send),
  generateTtsText: (msg, send) => handleTtsTextGeneration(msg.url, msg.customSystemPrompt, send),
  generateTtsAudio: (msg, send) => handleTtsAudioGeneration(msg.text, msg.voice, send),
  getTtsStatus: statusHandler(getTtsStatus),

  // Maps
  extractMapsData: (msg, send) => handleMapsExtraction(msg.url, send),
  getMapsDataStatus: statusHandler(getMapsDataStatus),
  controlMaps: (msg, send) => handleMapsControl(msg.url, msg.command, send),
  getMapsControlStatus: statusHandler(getMapsControlStatus),

  // Navigation
  navigateToUrl: async (msg, send) => {
    const { url, currentTabUrl } = msg;
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    const equalsMatch = currentTabUrl ? tabs.find(t => t.url === currentTabUrl) : undefined;
    const mapsMatch = tabs.find(t => (t.url || '').includes('/maps'));
    const activeMatch = tabs.find(t => t.active);
    const targetTab = equalsMatch || mapsMatch || activeMatch;

    if (!targetTab?.id) {
      send({ success: false, error: 'No suitable tab found to navigate' });
      return;
    }

    try {
      await chrome.tabs.update(targetTab.id, { url });
      console.log('navigateToUrl tabs.update succeeded for tab', targetTab.id, '→', url);
      send({ success: true, method: 'tabs.update' });
    } catch {
      try {
        await chrome.tabs.sendMessage(targetTab.id!, { action: 'navigateToUrl', url });
        send({ success: true, method: 'content-script' });
      } catch (msgErr) {
        send({ success: false, error: msgErr instanceof Error ? msgErr.message : 'Navigation failed' });
      }
    }
  },

  // Progress updates from content scripts
  updateExtractionProgress: (msg, send) => {
    console.log('📊 Extraction progress update:', msg.progress);
    send({ success: true });
  },

  // Data loading (for refresh without re-extraction)
  loadData: async (msg, send) => {
    const data = await backgroundDataController.loadData(msg.url);
    send({ success: true, data });
  },

};

// ---------------------------------------------------------------------------
// Single message listener — guaranteed return true, centralized error catch
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message.action];
  if (!handler) {
    // Not our message — let DataController's listener handle data actions
    // Return false (not undefined) so Chrome keeps the channel open for other listeners
    return false;
  }

  Promise.resolve(handler(message, sendResponse)).catch(err => {
    console.error(`❌ Handler error for "${message.action}":`, err);
    sendResponse({ success: false, error: err instanceof Error ? err.message : 'Handler error' });
  });

  return true; // Always keep channel open for async response
});

// ---------------------------------------------------------------------------
// Side panel lifecycle
// ---------------------------------------------------------------------------
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

chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extension installed, enabling panels for all tabs');
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) enablePanelForTab(tab.id);
    });
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id) {
    console.log('📌 New tab created:', tab.id);
    enablePanelForTab(tab.id);
  }
});

chrome.action.onClicked.addListener((tab) => {
  console.log('🔧 Extension icon clicked for tab:', tab.id);
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
    chrome.tabs.sendMessage(tab.id, { action: 'sidebarOpened' }).catch((err) => {
      console.warn('Failed to send sidebarOpened message to tab:', tab.id, err);
    });
  }
});
