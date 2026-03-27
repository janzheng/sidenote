import type { 
  LinkedInThread, 
  SocialMediaExtractionResponse,
  SocialMediaExpansionResponse 
} from '../../types/socialMedia';

interface LinkedInState {
  isExtracting: boolean;
  extractionStatus: 'idle' | 'extracting' | 'success' | 'error';
  extractionError: string | null;
  extractionProgress: {
    expandedCount: number;
    totalFound: number;
    currentStep: string;
  } | null;
}

class LinkedInManager {
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;

  private state = $state<LinkedInState>({
    isExtracting: false,
    extractionStatus: 'idle',
    extractionError: null,
    extractionProgress: null
  });

  // Getters for reactive state
  get isExtracting() {
    return this.state.isExtracting;
  }

  get extractionStatus() {
    return this.state.extractionStatus;
  }

  get extractionError() {
    return this.state.extractionError;
  }

  get extractionProgress() {
    return this.state.extractionProgress;
  }

  // Computed properties for UI styling
  get extractionButtonClass() {
    const baseClass = 'px-3 py-2 rounded text-sm font-medium transition-colors';
    
    switch (this.state.extractionStatus) {
      case 'extracting':
        return `${baseClass} bg-blue-100 text-blue-700 cursor-not-allowed`;
      case 'success':
        return `${baseClass} bg-green-100 text-green-700 hover:bg-green-200`;
      case 'error':
        return `${baseClass} bg-red-100 text-red-700 hover:bg-red-200`;
      default:
        return `${baseClass} bg-blue-600 text-white hover:bg-blue-700`;
    }
  }

  get extractionButtonText() {
    switch (this.state.extractionStatus) {
      case 'extracting':
        return 'Extracting Full Thread...';
      case 'success':
        return 'Re-extract Full Thread';
      case 'error':
        return 'Retry Full Extraction';
      default:
        return 'Extract Full Thread';
    }
  }

  // Extract LinkedIn thread functionality with auto-scrolling and expansion for maximum content
  async handleExtractThread(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isExtracting) {
      return;
    }

    this.state.isExtracting = true;
    this.state.extractionStatus = 'extracting';
    this.state.extractionError = null;
    
    // Initialize extraction progress for the scrolling and expansion phase
    this.state.extractionProgress = {
      expandedCount: 0,
      totalFound: 0,
      currentStep: 'Starting full thread extraction with auto-scroll and expansion...'
    };

    try {
      console.log('🔗 Starting LinkedIn full thread extraction with automatic scrolling and expansion for:', url);
      
      // Use the combined extraction + expansion approach for maximum thread capture
      const response = await chrome.runtime.sendMessage({
        action: 'extractLinkedInThreadWithScroll',
        url: url,
        maxScrolls: 50, // Maximum scrolling for complete thread capture
        scrollDelay: 400,
        maxExpansions: 100 // Maximum "see more" button clicks
      });

      if (response && response.success) {
        console.log('✅ LinkedIn full thread extraction successful');
        this.state.extractionStatus = 'success';
        this.state.extractionError = null;
        
        // Update progress with final results
        if (response.progress) {
          this.state.extractionProgress = {
            ...response.progress,
            currentStep: 'Full thread extraction completed'
          };
        }
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        if (this.statusTimeout) { clearTimeout(this.statusTimeout); }
        this.statusTimeout = setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.extractionProgress = null;
          this.statusTimeout = null;
        }, 3000);
      } else {
        const errorMsg = response?.error || 'No response from background script';
        console.error('❌ LinkedIn full thread extraction failed:', errorMsg);
        this.state.extractionStatus = 'error';
        this.state.extractionError = errorMsg;

        // Reset status after 5 seconds
        if (this.statusTimeout) { clearTimeout(this.statusTimeout); }
        this.statusTimeout = setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.extractionError = null;
          this.state.extractionProgress = null;
          this.statusTimeout = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ LinkedIn full thread extraction error:', error);
      this.state.extractionStatus = 'error';
      this.state.extractionError = error instanceof Error ? error.message : 'Unknown error';

      // Reset status after 5 seconds
      if (this.statusTimeout) { clearTimeout(this.statusTimeout); }
      this.statusTimeout = setTimeout(() => {
        this.state.extractionStatus = 'idle';
        this.state.extractionError = null;
        this.state.extractionProgress = null;
        this.statusTimeout = null;
      }, 5000);
    } finally {
      this.state.isExtracting = false;
    }
  }

  // Reset all state
  reset() {
    if (this.statusTimeout) { clearTimeout(this.statusTimeout); this.statusTimeout = null; }
    this.state.isExtracting = false;
    this.state.extractionStatus = 'idle';
    this.state.extractionError = null;
    this.state.extractionProgress = null;
  }

  // Check if extraction is available for the given URL
  canExtract(url: string | null): boolean {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return hostname.includes('linkedin.com');
    } catch {
      return false;
    }
  }

  // Format progress text for display
  getProgressText(): string {
    if (!this.state.extractionProgress) {
      return '';
    }

    const { expandedCount, totalFound, currentStep } = this.state.extractionProgress;
    
    if (expandedCount > 0 || totalFound > 0) {
      return `${currentStep} (${expandedCount} expansions, ${totalFound} elements)`;
    }
    
    return currentStep;
  }

  // Check if currently processing
  get isProcessing(): boolean {
    return this.state.isExtracting;
  }

  // Get current processing status text
  get processingStatus(): string {
    if (this.state.isExtracting) {
      return this.getProgressText() || 'Extracting full LinkedIn thread...';
    }
    return '';
  }
}

// Create and export singleton instance
export const linkedInManager = new LinkedInManager(); 