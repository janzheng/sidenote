import type { PageAssets, ScreenshotInfo } from '../../types/pageAssets';

type PageAssetsStatus = 'idle' | 'extracting' | 'success' | 'error';
type ScreenshotStatus = 'idle' | 'generating' | 'success' | 'error';

interface PageAssetsState {
  isExtracting: boolean;
  extractionStatus: PageAssetsStatus;
  extractionError: string | null;
  isGeneratingPageshot: boolean;
  pageshotStatus: ScreenshotStatus;
  pageshotError: string | null;
  isGeneratingScreenshot: boolean;
  screenshotStatus: ScreenshotStatus;
  screenshotError: string | null;
}

class PageAssetsManager {
  private state = $state<PageAssetsState>({
    isExtracting: false,
    extractionStatus: 'idle',
    extractionError: null,
    isGeneratingPageshot: false,
    pageshotStatus: 'idle',
    pageshotError: null,
    isGeneratingScreenshot: false,
    screenshotStatus: 'idle',
    screenshotError: null
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

  get isGeneratingPageshot() {
    return this.state.isGeneratingPageshot;
  }

  get pageshotStatus() {
    return this.state.pageshotStatus;
  }

  get pageshotError() {
    return this.state.pageshotError;
  }

  get isGeneratingScreenshot() {
    return this.state.isGeneratingScreenshot;
  }

  get screenshotStatus() {
    return this.state.screenshotStatus;
  }

  get screenshotError() {
    return this.state.screenshotError;
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

  // Generate pageshot functionality with optional refresh callback
  async handleGeneratePageshot(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isGeneratingPageshot) {
      return;
    }

    this.state.isGeneratingPageshot = true;
    this.state.pageshotStatus = 'generating';
    this.state.pageshotError = null;

    try {
      console.log('📸 Starting pageshot generation for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'generatePageshot',
        url: url
      });

      if (response.success) {
        console.log('✅ Pageshot generation successful');
        this.state.pageshotStatus = 'success';
        this.state.pageshotError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.pageshotStatus = 'idle';
        }, 3000);
      } else {
        console.error('❌ Pageshot generation failed:', response.error);
        this.state.pageshotStatus = 'error';
        this.state.pageshotError = response.error;
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.pageshotStatus = 'idle';
          this.state.pageshotError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Pageshot generation error:', error);
      this.state.pageshotStatus = 'error';
      this.state.pageshotError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.pageshotStatus = 'idle';
        this.state.pageshotError = null;
      }, 5000);
    } finally {
      this.state.isGeneratingPageshot = false;
    }
  }

  // Generate screenshot functionality with optional refresh callback
  async handleGenerateScreenshot(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isGeneratingScreenshot) {
      return;
    }

    this.state.isGeneratingScreenshot = true;
    this.state.screenshotStatus = 'generating';
    this.state.screenshotError = null;

    try {
      console.log('📷 Starting screenshot generation for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateScreenshot',
        url: url
      });

      if (response.success) {
        console.log('✅ Screenshot generation successful');
        this.state.screenshotStatus = 'success';
        this.state.screenshotError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.screenshotStatus = 'idle';
        }, 3000);
      } else {
        console.error('❌ Screenshot generation failed:', response.error);
        this.state.screenshotStatus = 'error';
        this.state.screenshotError = response.error;
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.screenshotStatus = 'idle';
          this.state.screenshotError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Screenshot generation error:', error);
      this.state.screenshotStatus = 'error';
      this.state.screenshotError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.screenshotStatus = 'idle';
        this.state.screenshotError = null;
      }, 5000);
    } finally {
      this.state.isGeneratingScreenshot = false;
    }
  }

  // Reset page assets state
  reset() {
    this.state.isExtracting = false;
    this.state.extractionStatus = 'idle';
    this.state.extractionError = null;
    this.state.isGeneratingPageshot = false;
    this.state.pageshotStatus = 'idle';
    this.state.pageshotError = null;
    this.state.isGeneratingScreenshot = false;
    this.state.screenshotStatus = 'idle';
    this.state.screenshotError = null;
  }
}

// Export singleton instance
export const pageAssetsManager = new PageAssetsManager(); 