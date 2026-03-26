class ContentStructureManager {
  private state = $state({
    isParsing: false,
    parseError: null as string | null
  });

  // Getters for reactive state
  get isParsing() {
    return this.state.isParsing;
  }

  get parseError() {
    return this.state.parseError;
  }

  // Parse content structure functionality with optional refresh callback
  async handleParseContentStructure(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isParsing) {
      return;
    }

    this.state.isParsing = true;
    this.state.parseError = null;

    try {
      console.log('🔍 Starting content structure parsing for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'parseContentStructure',
        url: url
      });

      if (response.success) {
        console.log('✅ Content structure parsing successful');
        this.state.parseError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
      } else {
        console.error('❌ Content structure parsing failed:', response.error);
        this.state.parseError = response.error;
      }
    } catch (error) {
      console.error('❌ Content structure parsing error:', error);
      this.state.parseError = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.state.isParsing = false;
    }
  }

  // Reset content structure state
  reset() {
    this.state.isParsing = false;
    this.state.parseError = null;
  }
}

// Export singleton instance
export const contentStructureManager = new ContentStructureManager(); 