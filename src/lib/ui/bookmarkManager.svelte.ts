type BookmarkStatus = 'idle' | 'success' | 'error';

interface BookmarkState {
  isQuickBookmarking: boolean;
  quickBookmarkStatus: BookmarkStatus;
  quickBookmarkError: string | null;
}

class BookmarkManager {
  private state = $state<BookmarkState>({
    isQuickBookmarking: false,
    quickBookmarkStatus: 'idle',
    quickBookmarkError: null
  });

  // Getters for reactive state
  get isQuickBookmarking() {
    return this.state.isQuickBookmarking;
  }

  get quickBookmarkStatus() {
    return this.state.quickBookmarkStatus;
  }

  get quickBookmarkError() {
    return this.state.quickBookmarkError;
  }

  // Quick bookmark functionality with optional refresh callback
  async handleQuickBookmark(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isQuickBookmarking) {
      return;
    }

    this.state.isQuickBookmarking = true;
    this.state.quickBookmarkStatus = 'idle';
    this.state.quickBookmarkError = null;

    try {
      console.log('🔖 Starting quick bookmark for:', url);
      
      // Show fake success after 1.5 seconds for better UX (Google Sheets is slow)
      setTimeout(() => {
        if (this.state.isQuickBookmarking) {
          this.state.isQuickBookmarking = false;
          this.state.quickBookmarkStatus = 'success';
          this.state.quickBookmarkError = null;
          
          // Call the success callback for the fake success
          if (onSuccess) {
            setTimeout(() => {
              onSuccess();
            }, 100);
          }
        }
      }, 1500);
      
      // Process the actual bookmark in the background
      const response = await chrome.runtime.sendMessage({
        action: 'bookmarkContent',
        url: url
      });

      if (response.success) {
        console.log('✅ Quick bookmark API call successful');
        
        // Ensure we're in success state (in case the timeout hasn't fired yet)
        this.state.isQuickBookmarking = false;
        this.state.quickBookmarkStatus = 'success';
        this.state.quickBookmarkError = null;
        
        // Reset status after 3 seconds from now
        setTimeout(() => {
          this.state.quickBookmarkStatus = 'idle';
        }, 3000);
      } else {
        console.error('❌ Quick bookmark API call failed:', response.error);
        // Only show error if we haven't already shown fake success
        if (this.state.quickBookmarkStatus !== 'success' as BookmarkStatus) {
          this.state.isQuickBookmarking = false;
          this.state.quickBookmarkStatus = 'error';
          this.state.quickBookmarkError = response.error;
        } else {
          // If we already showed fake success, just log the error but keep the success state
          console.warn('⚠️ Bookmark API failed but user already saw success state:', response.error);
        }
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.quickBookmarkStatus = 'idle';
          this.state.quickBookmarkError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Quick bookmark error:', error);
      // Only show error if we haven't already shown fake success
      if (this.state.quickBookmarkStatus !== 'success' as BookmarkStatus) {
        this.state.isQuickBookmarking = false;
        this.state.quickBookmarkStatus = 'error';
        this.state.quickBookmarkError = error instanceof Error ? error.message : 'Unknown error';
      } else {
        // If we already showed fake success, just log the error but keep the success state
        console.warn('⚠️ Bookmark error but user already saw success state:', error);
      }
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.quickBookmarkStatus = 'idle';
        this.state.quickBookmarkError = null;
      }, 5000);
    }
  }

  // Get CSS classes for quick bookmark button based on status
  getQuickBookmarkClass() {
    if (this.state.quickBookmarkStatus === 'success') {
      return 'px-6 py-1 rounded text-md text-white bg-green-600 border border-green-600 hover:bg-green-700 flex items-center gap-1';
    } else if (this.state.quickBookmarkStatus === 'error') {
      return 'px-6 py-1 rounded text-md text-white bg-red-600 border border-red-600 hover:bg-red-700 flex items-center gap-1';
    }
    return 'px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1';
  }

  // Reset bookmark state
  reset() {
    this.state.isQuickBookmarking = false;
    this.state.quickBookmarkStatus = 'idle';
    this.state.quickBookmarkError = null;
  }
}

// Export singleton instance
export const bookmarkManager = new BookmarkManager();
