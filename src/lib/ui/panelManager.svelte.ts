// Tab-scoped panel manager - each side panel instance manages its own state
// No global singleton, no cross-tab contamination

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
  get title() { return this.state.title; }
  
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
  
  get contentMetadata() {
    return this.state.content?.content?.metadata || {};
  }
  
  get wordCount() {
    return this.state.content?.content?.wordCount || 0;
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
        
        // Check if URL actually changed
        if (tab.url === this.state.url && tab.url === this.lastExtractedUrl) {
          console.log('🔄 URL unchanged, skipping extraction');
          return;
        }
        
        // Update tab info
        this.state.tabId = tab.id!;
        this.state.url = tab.url!;
        this.state.title = tab.title!;
        
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

    // Check if we already extracted this URL
    if (this.state.url === this.lastExtractedUrl && this.state.content) {
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