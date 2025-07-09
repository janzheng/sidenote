import type { SummaryStatus } from '../../types/summaryStatus';
import type { SummaryState } from '../../types/summaryState';

class SummaryManager {
  private state = $state<SummaryState>({
    isGenerating: false,
    summaryStatus: 'idle',
    summaryError: null
  });

  // Getters for reactive state
  get isGenerating() {
    return this.state.isGenerating;
  }

  get summaryStatus() {
    return this.state.summaryStatus;
  }

  get summaryError() {
    return this.state.summaryError;
  }

  // Generate summary functionality with optional refresh callback
  async handleGenerateSummary(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isGenerating) {
      return;
    }

    this.state.isGenerating = true;
    this.state.summaryStatus = 'generating';
    this.state.summaryError = null;

    try {
      console.log('🤖 Starting summary generation for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateSummary',
        url: url
      });

      if (response.success) {
        console.log('✅ Summary generation successful');
        this.state.summaryStatus = 'success';
        this.state.summaryError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.summaryStatus = 'idle';
        }, 3000);
      } else {
        console.error('❌ Summary generation failed:', response.error);
        this.state.summaryStatus = 'error';
        this.state.summaryError = response.error;
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.summaryStatus = 'idle';
          this.state.summaryError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Summary generation error:', error);
      this.state.summaryStatus = 'error';
      this.state.summaryError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.summaryStatus = 'idle';
        this.state.summaryError = null;
      }, 5000);
    } finally {
      this.state.isGenerating = false;
    }
  }

  // Get CSS classes for summary button based on status
  getSummaryButtonClass() {
    if (this.state.summaryStatus === 'success') {
      return 'px-6 py-1 rounded text-md text-white bg-green-600 border border-green-600 hover:bg-green-700 flex items-center gap-1';
    } else if (this.state.summaryStatus === 'error') {
      return 'px-6 py-1 rounded text-md text-white bg-red-600 border border-red-600 hover:bg-red-700 flex items-center gap-1';
    } else if (this.state.summaryStatus === 'generating') {
      return 'px-6 py-1 rounded text-md text-white bg-blue-600 border border-blue-600 hover:bg-blue-700 flex items-center gap-1';
    }
    return 'px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1';
  }

  // Reset summary state
  reset() {
    this.state.isGenerating = false;
    this.state.summaryStatus = 'idle';
    this.state.summaryError = null;
  }
}

// Export singleton instance
export const summaryManager = new SummaryManager(); 