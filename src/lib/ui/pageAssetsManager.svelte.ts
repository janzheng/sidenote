import type { PageAssets } from '../../types/pageAssets';

type PageAssetsStatus = 'idle' | 'extracting' | 'success' | 'error';

interface PageAssetsState {
  isExtracting: boolean;
  extractionStatus: PageAssetsStatus;
  extractionError: string | null;
}

class PageAssetsManager {
  private state = $state<PageAssetsState>({
    isExtracting: false,
    extractionStatus: 'idle',
    extractionError: null
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

  // Extract page assets functionality with optional refresh callback
  async handleExtractPageAssets(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isExtracting) {
      return;
    }

    this.state.isExtracting = true;
    this.state.extractionStatus = 'extracting';
    this.state.extractionError = null;

    try {
      console.log('🎨 Starting page assets extraction for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'extractPageAssets',
        url: url
      });

      if (response.success) {
        console.log('✅ Page assets extraction successful');
        this.state.extractionStatus = 'success';
        this.state.extractionError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
        }, 3000);
      } else {
        console.error('❌ Page assets extraction failed:', response.error);
        this.state.extractionStatus = 'error';
        this.state.extractionError = response.error;
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.extractionError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Page assets extraction error:', error);
      this.state.extractionStatus = 'error';
      this.state.extractionError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.extractionStatus = 'idle';
        this.state.extractionError = null;
      }, 5000);
    } finally {
      this.state.isExtracting = false;
    }
  }

  // Get CSS classes for extraction button based on status
  getExtractionButtonClass() {
    if (this.state.extractionStatus === 'success') {
      return 'px-6 py-1 rounded text-md text-white bg-green-600 border border-green-600 hover:bg-green-700 flex items-center gap-1';
    } else if (this.state.extractionStatus === 'error') {
      return 'px-6 py-1 rounded text-md text-white bg-red-600 border border-red-600 hover:bg-red-700 flex items-center gap-1';
    } else if (this.state.extractionStatus === 'extracting') {
      return 'px-6 py-1 rounded text-md text-white bg-blue-600 border border-blue-600 hover:bg-blue-700 flex items-center gap-1';
    }
    return 'px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1';
  }

  // Reset page assets state
  reset() {
    this.state.isExtracting = false;
    this.state.extractionStatus = 'idle';
    this.state.extractionError = null;
  }
}

// Export singleton instance
export const pageAssetsManager = new PageAssetsManager(); 