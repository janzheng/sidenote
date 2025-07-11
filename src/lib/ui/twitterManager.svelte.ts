import type { 
  TwitterThread, 
  SocialMediaExtractionResponse,
  SocialMediaExpansionResponse 
} from '../../types/socialMedia';

interface TwitterState {
  isExtracting: boolean;
  extractionStatus: 'idle' | 'extracting' | 'success' | 'error';
  extractionError: string | null;
  extractionProgress: {
    expandedCount: number;
    totalFound: number;
    currentStep: string;
  } | null;
}

class TwitterManager {
  private state = $state<TwitterState>({
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

  // Extract Twitter thread functionality with auto-scrolling for maximum content
  async handleExtractThread(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isExtracting) {
      return;
    }

    this.state.isExtracting = true;
    this.state.extractionStatus = 'extracting';
    this.state.extractionError = null;
    
    // Initialize extraction progress for the scrolling phase
    this.state.extractionProgress = {
      expandedCount: 0,
      totalFound: 0,
      currentStep: 'Starting full thread extraction with scroll and text expansion...'
    };

    try {
      console.log('🐦 Starting Twitter full thread extraction with automatic scrolling for:', url);
      
      // Always use the combined extraction + expansion approach for maximum thread capture
      const response = await chrome.runtime.sendMessage({
        action: 'extractTwitterThreadWithScroll',
        url: url,
        maxScrolls: 150, // Increased from 100 for more thorough extraction
        scrollDelay: 300
      });

      if (response.success) {
        console.log('✅ Twitter full thread extraction successful');
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
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.extractionProgress = null;
        }, 3000);
      } else {
        console.error('❌ Twitter full thread extraction failed:', response.error);
        this.state.extractionStatus = 'error';
        this.state.extractionError = response.error;
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.extractionError = null;
          this.state.extractionProgress = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Twitter full thread extraction error:', error);
      this.state.extractionStatus = 'error';
      this.state.extractionError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.extractionStatus = 'idle';
        this.state.extractionError = null;
        this.state.extractionProgress = null;
      }, 5000);
    } finally {
      this.state.isExtracting = false;
    }
  }

  // Reset all state
  reset() {
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
      return hostname.includes('twitter.com') || hostname.includes('x.com');
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
      return `${currentStep} (${expandedCount} text expansions, ${totalFound} tweets)`;
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
      return this.getProgressText() || 'Extracting full Twitter thread...';
    }
    return '';
  }
}

// Create and export singleton instance
export const twitterManager = new TwitterManager(); 