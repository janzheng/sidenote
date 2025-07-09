import type { TabData } from '../../types/tabData';

export interface DataMessage {
  action: 'saveData' | 'loadData' | 'hasData' | 'clearData';
  url: string;
  data?: Partial<TabData>;
  timestamp?: number;
}

export interface DataResponse {
  success: boolean;
  data?: TabData | null;
  exists?: boolean;
  error?: string;
}

/**
 * Shared data controller for URL-based storage
 * Can be used by both content script and background script
 */
export class DataController {
  private storage = new Map<string, TabData>();
  private context: 'content' | 'background';

  constructor(context: 'content' | 'background') {
    this.context = context;
    this.setupMessageListener();
  }

  /**
   * Normalize URL for consistent storage keys
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove fragment and some query params that don't affect content
      urlObj.hash = '';
      // You could add more normalization logic here if needed
      return urlObj.href;
    } catch {
      return url; // Fallback to original if URL parsing fails
    }
  }

  /**
   * Save data for a specific URL
   */
  async saveData(url: string, data: Partial<TabData>): Promise<boolean> {
    const normalizedUrl = this.normalizeUrl(url);
    
    try {
      // Get existing data or create new
      const existing = this.storage.get(normalizedUrl) || this.createEmptyTabData(normalizedUrl);
      
      // Deep merge the data
      const updated = this.mergeTabData(existing, data);
      updated.meta.lastUpdated = Date.now();
      
      // Store in memory
      this.storage.set(normalizedUrl, updated);
      
      // If we're in background, also persist to chrome.storage
      if (this.context === 'background') {
        await this.persistToStorage(normalizedUrl, updated);
      } else {
        // If we're in content script, send to background for persistence
        await this.sendToBackground('saveData', normalizedUrl, data);
      }
      
      console.log(`💾 Data saved for ${normalizedUrl}`, { context: this.context });
      return true;
    } catch (error) {
      console.error(`❌ Failed to save data for ${normalizedUrl}:`, error);
      return false;
    }
  }

  /**
   * Load data for a specific URL, optionally forcing refresh from background
   */
  async loadData(url: string, forceRefresh: boolean = false): Promise<TabData | null> {
    const normalizedUrl = this.normalizeUrl(url);
    
    try {
      // Check memory first (unless forcing refresh)
      let data = forceRefresh ? null : this.storage.get(normalizedUrl);
      
             if (!data && this.context === 'background') {
         // Try to load from chrome.storage if we're in background
         const storedData = await this.loadFromStorage(normalizedUrl);
         if (storedData) {
           data = storedData;
           this.storage.set(normalizedUrl, data);
         }
       } else if (!data && this.context === 'content') {
         // If we're in content script, ask background
         const response = await this.sendToBackground('loadData', normalizedUrl);
         data = response?.data || undefined;
         if (data) {
           this.storage.set(normalizedUrl, data);
         }
       }
      
      console.log(`📖 Data loaded for ${normalizedUrl}`, { 
        found: !!data, 
        context: this.context 
      });
      return data || null;
    } catch (error) {
      console.error(`❌ Failed to load data for ${normalizedUrl}:`, error);
      return null;
    }
  }

  /**
   * Check if data exists for a URL
   */
  async hasData(url: string): Promise<boolean> {
    const normalizedUrl = this.normalizeUrl(url);
    
    if (this.storage.has(normalizedUrl)) {
      return true;
    }
    
    if (this.context === 'background') {
      const data = await this.loadFromStorage(normalizedUrl);
      return !!data;
    } else {
      const response = await this.sendToBackground('hasData', normalizedUrl);
      return response?.exists || false;
    }
  }

  /**
   * Clear data for a specific URL
   */
  async clearData(url: string): Promise<boolean> {
    const normalizedUrl = this.normalizeUrl(url);
    
    try {
      this.storage.delete(normalizedUrl);
      
      if (this.context === 'background') {
        await this.removeFromStorage(normalizedUrl);
      } else {
        await this.sendToBackground('clearData', normalizedUrl);
      }
      
      console.log(`🗑️ Data cleared for ${normalizedUrl}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to clear data for ${normalizedUrl}:`, error);
      return false;
    }
  }

  /**
   * Get all stored URLs
   */
  getStoredUrls(): string[] {
    return Array.from(this.storage.keys());
  }

  /**
   * Create empty TabData structure
   */
  private createEmptyTabData(url: string): TabData {
    return {
      content: {
        url,
        text: '',
        html: '',
        markdown: '',
        title: '',
        metadata: {},
        wordCount: 0,
        extractedAt: Date.now()
      },
      analysis: {
        summary: null,
        citations: null,
        researchPaper: null,
        contentStructure: null,
        chatMessages: null,
        threadgirlResults: null,
        pageAssets: null
      },
      statuses: {
        bookmarkStatus: 'not-bookmarked'
      },
      processing: {
        summary: { isStreaming: false, error: null },
        citations: { isGenerating: false, error: null },
        researchPaper: { isExtracting: false, progress: '', error: null },
        chat: { isGenerating: false, error: null },
        threadgirl: { isProcessing: false, error: null },
        pageAssets: { isExtracting: false, error: null }
      },
      meta: {
        contentId: this.generateContentId(url),
        lastUpdated: Date.now(),
        activeTabIds: new Set(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Deep merge TabData objects
   */
  private mergeTabData(existing: TabData, update: Partial<TabData>): TabData {
    return {
      content: { ...existing.content, ...update.content },
      analysis: { ...existing.analysis, ...update.analysis },
      statuses: { ...existing.statuses, ...update.statuses },
      processing: { ...existing.processing, ...update.processing },
      meta: { ...existing.meta, ...update.meta }
    };
  }

  /**
   * Generate content ID from URL
   */
  private generateContentId(url: string): string {
    // Simple hash function for content ID
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `content_${Math.abs(hash)}_${Date.now()}`;
  }

  /**
   * Persist to chrome.storage (background only)
   */
  private async persistToStorage(url: string, data: TabData): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const key = `tabdata_${url}`;
      await chrome.storage.local.set({ [key]: data });
    }
  }

  /**
   * Load from chrome.storage (background only)
   */
  private async loadFromStorage(url: string): Promise<TabData | null> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const key = `tabdata_${url}`;
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    }
    return null;
  }

  /**
   * Remove from chrome.storage (background only)
   */
  private async removeFromStorage(url: string): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const key = `tabdata_${url}`;
      await chrome.storage.local.remove(key);
    }
  }

  /**
   * Send message to background script (content script only)
   */
  private async sendToBackground(action: string, url: string, data?: Partial<TabData>): Promise<DataResponse | null> {
    if (this.context === 'content' && typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const message: DataMessage = { action: action as any, url, data, timestamp: Date.now() };
        const response = await chrome.runtime.sendMessage(message);
        return response;
      } catch (error) {
        console.error('Failed to send message to background:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Setup message listener for cross-context communication
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime && this.context === 'background') {
      chrome.runtime.onMessage.addListener((message: DataMessage, sender, sendResponse) => {
        if (message.action && ['saveData', 'loadData', 'hasData', 'clearData'].includes(message.action)) {
          this.handleDataMessage(message).then(sendResponse);
          return true; // Keep message channel open
        }
      });
    }
  }

  /**
   * Handle data messages (background only)
   */
  private async handleDataMessage(message: DataMessage): Promise<DataResponse> {
    try {
      switch (message.action) {
        case 'saveData':
          if (message.data) {
            const success = await this.saveData(message.url, message.data);
            return { success };
          }
          return { success: false, error: 'No data provided' };

        case 'loadData':
          const data = await this.loadData(message.url);
          return { success: true, data };

        case 'hasData':
          const exists = await this.hasData(message.url);
          return { success: true, exists };

        case 'clearData':
          const cleared = await this.clearData(message.url);
          return { success: cleared };

        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance for content script (since it's simpler to have one global instance there)
export const contentDataController = new DataController('content'); 