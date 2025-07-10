import type { ResearchPaperAnalysis } from '../../types/researchPaper';

interface ResearchPaperState {
  isExtracting: boolean;
  extractionStatus: 'idle' | 'extracting' | 'success' | 'error';
  extractionError: string | null;
  progress: string;
}

class ResearchPaperManager {
  private state = $state<ResearchPaperState>({
    isExtracting: false,
    extractionStatus: 'idle',
    extractionError: null,
    progress: ''
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

  get progress() {
    return this.state.progress;
  }

  // Extract research paper functionality with optional refresh callback
  async handleExtractResearchPaper(url: string | null, userBackground?: string, onSuccess?: () => void) {
    if (!url || this.state.isExtracting) {
      return;
    }

    this.state.isExtracting = true;
    this.state.extractionStatus = 'extracting';
    this.state.extractionError = null;
    this.state.progress = 'Starting research paper extraction...';

    try {
      console.log('🔬 Starting research paper extraction for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'extractResearchPaper',
        url: url,
        userBackground: userBackground
      });

      if (response.success) {
        console.log('✅ Research paper extraction successful');
        this.state.extractionStatus = 'success';
        this.state.extractionError = null;
        this.state.progress = 'Research paper extraction complete!';
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.progress = '';
        }, 3000);
      } else {
        console.error('❌ Research paper extraction failed:', response.error);
        this.state.extractionStatus = 'error';
        this.state.extractionError = response.error;
        this.state.progress = '';
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.extractionError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Research paper extraction error:', error);
      this.state.extractionStatus = 'error';
      this.state.extractionError = error instanceof Error ? error.message : 'Unknown error';
      this.state.progress = '';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.extractionStatus = 'idle';
        this.state.extractionError = null;
      }, 5000);
    } finally {
      this.state.isExtracting = false;
    }
  }

  // Quick extraction functionality
  async handleQuickExtractResearchPaper(url: string | null, userBackground?: string, onSuccess?: () => void) {
    if (!url || this.state.isExtracting) {
      return;
    }

    this.state.isExtracting = true;
    this.state.extractionStatus = 'extracting';
    this.state.extractionError = null;
    this.state.progress = 'Starting quick research paper analysis...';

    try {
      console.log('⚡ Starting quick research paper extraction for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'extractResearchPaperQuick',
        url: url,
        userBackground: userBackground
      });

      if (response.success) {
        console.log('✅ Quick research paper extraction successful');
        this.state.extractionStatus = 'success';
        this.state.extractionError = null;
        this.state.progress = 'Quick analysis complete!';
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100);
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.progress = '';
        }, 3000);
      } else {
        console.error('❌ Quick research paper extraction failed:', response.error);
        this.state.extractionStatus = 'error';
        this.state.extractionError = response.error;
        this.state.progress = '';
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.extractionStatus = 'idle';
          this.state.extractionError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Quick research paper extraction error:', error);
      this.state.extractionStatus = 'error';
      this.state.extractionError = error instanceof Error ? error.message : 'Unknown error';
      this.state.progress = '';
      
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

  // Reset research paper state
  reset() {
    this.state.isExtracting = false;
    this.state.extractionStatus = 'idle';
    this.state.extractionError = null;
    this.state.progress = '';
  }
}

// Export singleton instance
export const researchPaperManager = new ResearchPaperManager(); 