// Tab-scoped panel manager - each side panel instance manages its own state
// No global singleton, no cross-tab contamination

import { bookmarkManager } from './bookmarkManager.svelte';
import { summaryManager } from './summaryManager.svelte';
import { chatManager } from './chatManager.svelte';
import { threadgirlManager } from './threadgirlManager.svelte';
import { contentStructureManager } from './contentStructureManager.svelte';
import { normalizeUrl } from '../utils/contentId';

export interface PanelState {
  content: any | null;
  isLoading: boolean;
  error: string | null;
  tabId: number | null;
  url: string | null;
  title: string | null;
}

export class PanelManager {
  private state = $state<PanelState>({
    content: null,
    isLoading: false,
    error: null,
    tabId: null,
    url: null,
    title: null
  });

  // Deduplication and throttling
  private lastExtractedUrl: string | null = null;
  private extractionPromise: Promise<void> | null = null;
  private refreshTimeout: number | null = null;

  constructor() {
    this.initialize();
    this.setupEventListeners();
  }

  // Reactive getters
  get content() { return this.state.content; }
  get isLoading() { return this.state.isLoading; }
  get error() { return this.state.error; }
  get tabId() { return this.state.tabId; }
  get url() { return this.state.url; }
  get title() {
    // Priority: PDF-extracted title > original title > fallback
    const pdfTitle = this.state.content?.content?.metadata?.citations?.title;
    const originalTitle = this.state.content?.content?.title || this.state.title;

    return pdfTitle || originalTitle || 'Untitled';
  }
  get metadata() { return this.state.content?.content?.metadata || {}; }
  
  // Check if current content is bookmarked
  get isBookmarked() {
    return this.state.content?.statuses?.bookmarkStatus === 'success';
  }
  
  // Convenience getters for content fields
  get contentText() {
    return this.state.content?.content?.text || '';
  }
  
  get contentHtml() {
    return this.state.content?.content?.html || '';
  }
  
  get contentMarkdown() {
    return this.state.content?.content?.markdown || '';
  }
  
  
  get description() {
    // Priority: PDF-extracted abstract > metadata description > meta tag abstract > fallback
    const pdfAbstract = this.state.content?.content?.metadata?.citations?.abstract;
    const metadataDescription = this.state.content?.content?.metadata?.description;
    const metaTagAbstract = this.state.content?.content?.metadata?.citations?.abstract_meta;
    
    return pdfAbstract || metadataDescription || metaTagAbstract || null;
  }

  // Enhanced metadata getters
  get contentMetadata() { 
    const baseMetadata = this.state.content?.content?.metadata || {};
    
    // Debug logging for PDF metadata
    if (baseMetadata.contentType === 'pdf' || baseMetadata.isPDF) {
      console.log('📄 PDF metadata in panelManager:', {
        hasAuthor: !!baseMetadata.author,
        hasDescription: !!baseMetadata.description,
        hasTitle: !!baseMetadata.title,
        hasCitations: !!baseMetadata.citations,
        citationFields: baseMetadata.citations ? Object.keys(baseMetadata.citations) : [],
        author: baseMetadata.author,
        description: baseMetadata.description,
        title: baseMetadata.title
      });
    }
    
    // Enhance with PDF-extracted data if available
    const enhancedMetadata = {
      ...baseMetadata,
      // Use PDF-extracted title if available
      title: this.title,
      // Use PDF-extracted abstract as description if available
      description: this.description,
      // Use PDF-extracted author information if available
      author: this.state.content?.content?.metadata?.author || baseMetadata.author
    };
    
    return enhancedMetadata;
  }
  
  get wordCount() {
    return this.state.content?.content?.wordCount || 0;
  }

  // Enhanced metadata getters for the new citation capabilities
  get citations() {
    return this.state.content?.content?.metadata?.citations || null;
  }
  
  get hasCitations() {
    return !!this.citations && Object.keys(this.citations).length > 0;
  }
  
  get doi() {
    return this.citations?.doi || null;
  }
  
  get pmid() {
    return this.citations?.pmid || null;
  }
  
  get arxiv() {
    return this.citations?.arxiv || null;
  }
  
  get authors() {
    return this.citations?.authors || [];
  }
  
  get firstAuthor() {
    return this.citations?.first_author || null;
  }
  
  get journal() {
    return this.citations?.journal || null;
  }
  
  get publicationDate() {
    return this.citations?.publication_date || null;
  }
  
  get publicationYear() {
    return this.citations?.year || null;
  }
  
  get articleType() {
    return this.citations?.type || null;
  }
  
  get abstract() {
    // Priority: AI-extracted abstract > meta tag abstract
    return this.citations?.abstract || this.citations?.abstract_meta || null;
  }
  
  get pdfUrl() {
    return this.citations?.pdf_url || null;
  }
  
  get abstractUrl() {
    return this.citations?.abstract_url || null;
  }
  
  // Schema.org/JSON-LD data getters
  get schemaData() {
    return this.state.content?.content?.metadata?.schemaData || [];
  }
  
  get hasSchemaData() {
    return this.schemaData.length > 0;
  }
  
  get schemaType() {
    return this.state.content?.content?.metadata?.schemaType || null;
  }
  
  // Enhanced metadata getters
  get images() {
    return this.state.content?.content?.metadata?.images || null;
  }
  
  get imageCount() {
    return this.images?.count || 0;
  }
  
  get uniqueImageCount() {
    return this.images?.uniqueCount || 0;
  }
  
  get links() {
    return this.state.content?.content?.metadata?.links || null;
  }
  
  get internalLinkCount() {
    return this.links?.internal || 0;
  }
  
  get externalLinkCount() {
    return this.links?.external || 0;
  }
  
  get headings() {
    return this.state.content?.content?.metadata?.headings || null;
  }
  
  get h1Count() {
    return this.headings?.h1?.length || 0;
  }
  
  get h2Count() {
    return this.headings?.h2?.length || 0;
  }
  
  get h3Count() {
    return this.headings?.h3?.length || 0;
  }
  
  // Open Graph getters
  get ogTitle() {
    return this.state.content?.content?.metadata?.ogTitle || null;
  }
  
  get ogDescription() {
    return this.state.content?.content?.metadata?.ogDescription || null;
  }
  
  get ogImage() {
    return this.state.content?.content?.metadata?.ogImage || null;
  }
  
  get ogType() {
    return this.state.content?.content?.metadata?.ogType || null;
  }
  
  // Twitter Card getters
  get twitterCard() {
    return this.state.content?.content?.metadata?.twitterCard || null;
  }
  
  get twitterTitle() {
    return this.state.content?.content?.metadata?.twitterTitle || null;
  }
  
  get twitterDescription() {
    return this.state.content?.content?.metadata?.twitterDescription || null;
  }
  
  get twitterImage() {
    return this.state.content?.content?.metadata?.twitterImage || null;
  }
  
  // Helper method to get all available identifiers
  get allIdentifiers() {
    if (!this.citations) return {};
    
    const identifiers: Record<string, string> = {};
    
    if (this.citations.doi) identifiers.DOI = this.citations.doi;
    if (this.citations.pmid) identifiers.PMID = this.citations.pmid;
    if (this.citations.pmcid) identifiers.PMCID = this.citations.pmcid;
    if (this.citations.arxiv) identifiers.arXiv = this.citations.arxiv;
    if (this.citations.isbn) identifiers.ISBN = this.citations.isbn;
    if (this.citations.issn) identifiers.ISSN = this.citations.issn;
    
    return identifiers;
  }
  
  // Helper method to check if this is an academic/research paper
  get isAcademicPaper() {
    return !!(this.doi || this.pmid || this.arxiv || this.journal);
  }
  
  // Helper method to get citation summary
  get citationSummary() {
    if (!this.hasCitations) return null;
    
    const parts: string[] = [];
    
    if (this.firstAuthor) {
      const authorPart = this.authors.length > 1 
        ? `${this.firstAuthor} et al.` 
        : this.firstAuthor;
      parts.push(authorPart);
    }
    
    if (this.publicationYear) {
      parts.push(`(${this.publicationYear})`);
    }
    
    if (this.citations?.title) {
      parts.push(`"${this.citations.title}"`);
    }
    
    if (this.journal) {
      let journalPart = this.journal;
      if (this.citations?.volume) {
        journalPart += ` ${this.citations.volume}`;
        if (this.citations?.issue) {
          journalPart += `(${this.citations.issue})`;
        }
      }
      if (this.citations?.pages) {
        journalPart += `: ${this.citations.pages}`;
      }
      parts.push(journalPart);
    }
    
    return parts.join('. ');
  }

  private async initialize() {
    console.log('🎯 Initializing panel manager');
    
    // Check if we have URL parameters with tab/url info
    const urlParams = this.getUrlParameters();
    if (urlParams.tabId) {
      console.log('🎯 Found URL parameters:', urlParams);
      this.state.tabId = urlParams.tabId;
      if (urlParams.url) {
        this.state.url = urlParams.url;
      }
    }
    
    // Schedule initial refresh
    this.scheduleRefresh('initialization');
  }

  private getUrlParameters(): { tabId?: number; url?: string } {
    const params = new URLSearchParams(window.location.search);
    const result: { tabId?: number; url?: string } = {};
    
    const tabIdParam = params.get('tabId');
    if (tabIdParam) {
      result.tabId = parseInt(tabIdParam, 10);
    }
    
    const urlParam = params.get('url');
    if (urlParam) {
      result.url = decodeURIComponent(urlParam);
    }
    
    return result;
  }

  private setupEventListeners() {
    console.log('🎯 Setting up tab event listeners');
    
    // Listen for tab activation (user switches tabs)
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      console.log('🔄 Tab activated:', activeInfo.tabId, 'in window:', activeInfo.windowId);
      
      // Check if this activation is in our current window
      try {
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow.id === activeInfo.windowId) {
          console.log('🔄 Tab activation in our window, refreshing');
          this.scheduleRefresh('tab-activation');
        } else {
          console.log('🔄 Tab activation in different window, ignoring');
        }
      } catch (error) {
        console.error('Error checking window:', error);
      }
    });

    // Listen for tab navigation (URL changes within the same tab)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      // Only process meaningful changes
      if (changeInfo.url) {
        console.log('🔄 Tab URL changed:', tabId, 'URL:', changeInfo.url);
        
        // Check if this is just an anchor link navigation
        const normalizedNewUrl = normalizeUrl(changeInfo.url);
        const normalizedCurrentUrl = this.state.url ? normalizeUrl(this.state.url) : null;
        
        if (normalizedCurrentUrl && normalizedNewUrl === normalizedCurrentUrl) {
          console.log('🔄 Anchor link navigation detected, skipping refresh');
          // Still update the URL in state to reflect the new hash
          this.state.url = changeInfo.url;
          return;
        }
        
        // Check if this is the active tab in our window
        if (tab.active) {
          try {
            const currentWindow = await chrome.windows.getCurrent();
            if (tab.windowId === currentWindow.id) {
              console.log('🔄 Active tab URL change in our window, refreshing');
              this.scheduleRefresh('url-change');
            }
          } catch (error) {
            console.error('Error checking window for tab update:', error);
          }
        }
      } else if (changeInfo.status === 'complete') {
        console.log('🔄 Tab loading complete:', tabId);
        
        // Only refresh if we haven't extracted content for this URL yet
        if (tab.active && tab.url && tab.url !== this.lastExtractedUrl) {
          try {
            const currentWindow = await chrome.windows.getCurrent();
            if (tab.windowId === currentWindow.id) {
              console.log('🔄 Page load complete for new URL, refreshing');
              this.scheduleRefresh('load-complete');
            }
          } catch (error) {
            console.error('Error checking window for load complete:', error);
          }
        }
      }
    });
  }

  /** Schedule a refresh with throttling to prevent spam */
  private scheduleRefresh(reason: string) {
    // Clear any existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    // Schedule new refresh with a small delay to batch rapid events
    this.refreshTimeout = setTimeout(() => {
      console.log('🔄 Executing scheduled refresh:', reason);
      this.refreshCurrentTab();
      this.refreshTimeout = null;
    }, 100) as unknown as number;
  }

  /** Refresh with the active tab in this window */
  private async refreshCurrentTab() {
    try {
      this.state.error = null;
      
      // Get the active tab in the current window
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const tab = tabs[0];
        console.log('🎯 Current active tab:', tab.id, tab.url);
        
        // Validate tab URL
        if (!tab.url || tab.url.includes('chrome-extension://invalid')) {
          console.warn('⚠️ Invalid or missing tab URL detected:', tab.url);
          this.state.error = 'Invalid tab URL detected. Please refresh the page.';
          return;
        }
        
        // Skip chrome:// URLs and other non-web URLs
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
          console.log('🔄 Skipping system URL:', tab.url);
          this.state.error = 'Cannot extract content from system pages.';
          return;
        }
        
        // Check if URL actually changed (using normalized URLs for content comparison)
        const normalizedTabUrl = normalizeUrl(tab.url);
        const normalizedStateUrl = this.state.url ? normalizeUrl(this.state.url) : null;
        const normalizedLastExtracted = this.lastExtractedUrl ? normalizeUrl(this.lastExtractedUrl) : null;
        
        if (tab.url === this.state.url && normalizedTabUrl === normalizedLastExtracted) {
          console.log('🔄 URL unchanged, skipping extraction');
          return;
        }
        
        // Reset bookmark manager state when switching tabs/URLs (only for different normalized URLs)
        if (normalizedStateUrl && normalizedTabUrl !== normalizedStateUrl) {
          console.log('🔄 URL changed, resetting manager states');
          bookmarkManager.reset();
          summaryManager.reset();
          chatManager.reset();
          threadgirlManager.reset();
          contentStructureManager.reset();
        } else if (!normalizedStateUrl) {
          console.log('🔄 Initial URL set, resetting manager states');
          bookmarkManager.reset();
          summaryManager.reset();
          chatManager.reset();
          threadgirlManager.reset();
          contentStructureManager.reset();
        }
        
        // Update tab info
        this.state.tabId = tab.id!;
        this.state.url = tab.url;
        this.state.title = tab.title || 'Untitled';
        
        // Extract content for this specific tab (with deduplication)
        await this.extractContent();
      } else {
        this.state.error = 'Could not determine current tab';
        console.error('No active tab found');
      }
    } catch (error) {
      console.error('Failed to refresh current tab:', error);
      this.state.error = error instanceof Error ? error.message : 'Failed to refresh tab';
    }
  }

  private async extractContent() {
    if (!this.state.tabId || !this.state.url) {
      this.state.error = 'No tab ID or URL available';
      return;
    }

    // Prevent duplicate extractions
    if (this.extractionPromise) {
      console.log('🔄 Extraction already in progress, waiting...');
      await this.extractionPromise;
      return;
    }

    // Check if we already extracted this URL (using normalized URL for comparison)
    const normalizedCurrentUrl = normalizeUrl(this.state.url);
    const normalizedLastExtracted = this.lastExtractedUrl ? normalizeUrl(this.lastExtractedUrl) : null;
    
    if (normalizedCurrentUrl === normalizedLastExtracted && this.state.content) {
      console.log('🔄 Content already extracted for this URL, skipping');
      return;
    }

    // Create extraction promise for deduplication
    this.extractionPromise = this.performExtraction();
    
    try {
      await this.extractionPromise;
    } finally {
      this.extractionPromise = null;
    }
  }

  private async performExtraction() {
    try {
      this.state.isLoading = true;
      this.state.error = null;
      
      console.log('🎯 Extracting content for tab:', this.state.tabId, 'URL:', this.state.url);
      
      // Request content extraction from background script
      const response = await chrome.runtime.sendMessage({
        action: 'extractContentForCurrentTab',
        tabId: this.state.tabId
      });
      
      if (response.success && response.data) {
        console.log('✅ Content extracted successfully');
        console.log('🔍 Citation metadata found:', !!response.data?.content?.metadata?.citations);
        console.log('🔍 Schema data found:', !!response.data?.content?.metadata?.schemaData);
        this.state.content = response.data;
        this.lastExtractedUrl = this.state.url; // Mark as extracted
      } else {
        console.error('❌ Content extraction failed:', response.error);
        this.state.error = response.error || 'Failed to extract content';
      }
    } catch (error) {
      console.error('Failed to extract content:', error);
      this.state.error = error instanceof Error ? error.message : 'Content extraction failed';
    } finally {
      this.state.isLoading = false;
    }
  }

  // Manual refresh function
  async refresh() {
    // Force refresh by clearing cache
    this.lastExtractedUrl = null;
    await this.refreshCurrentTab();
  }

  // Refresh data only (without re-extracting content)
  async refreshDataOnly() {
    if (!this.state.url) {
      console.log('🔄 No URL available for data refresh');
      return;
    }

    try {
      this.state.isLoading = true;
      this.state.error = null;
      
      console.log('🔄 Refreshing data only for URL:', this.state.url);
      
      // Use the existing DataController messaging to load data
      const response = await chrome.runtime.sendMessage({
        action: 'loadData',
        url: this.state.url,
        timestamp: Date.now()
      });
      
      if (response.success && response.data) {
        console.log('✅ Data refreshed successfully');
        console.log('🔄 Loaded bookmark status:', response.data?.statuses?.bookmarkStatus);
        this.state.content = response.data;
        
        // Reset manager states after loading new data to ensure UI consistency
        // Note: Don't reset bookmarkManager as it maintains its own state independently
        summaryManager.reset();
        chatManager.reset();
        threadgirlManager.reset();
        contentStructureManager.reset();
      } else {
        console.log('ℹ️ No existing data found for URL');
        console.log('🔄 Response:', response);
        // Don't set error - this is normal for new URLs
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
      this.state.error = error instanceof Error ? error.message : 'Failed to refresh data';
    } finally {
      this.state.isLoading = false;
    }
  }

  // Clean up event listeners and timeouts
  cleanup() {
    console.log('🎯 Panel manager cleanup');
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    
    // Chrome extension event listeners are automatically cleaned up when the page unloads
    // No manual cleanup needed for chrome.tabs.onActivated/onUpdated
  }
}

// Create a new instance for this side panel (not a singleton!)
export const panelManager = new PanelManager(); 