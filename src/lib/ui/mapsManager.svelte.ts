import type { MapsData, MapsControlCommand } from '../../types/mapsData';

class MapsManager {
  private state = $state({
    isExtracting: false,
    isControlling: false,
    extractionError: null as string | null,
    controlError: null as string | null
  });

  // Getters for reactive state
  get isExtracting() {
    return this.state.isExtracting;
  }

  get isControlling() {
    return this.state.isControlling;
  }

  get extractionError() {
    return this.state.extractionError;
  }

  get controlError() {
    return this.state.controlError;
  }

  // Extract Maps data functionality with optional refresh callback
  async handleExtractMapsData(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isExtracting) {
      return;
    }

    this.state.isExtracting = true;
    this.state.extractionError = null;

    try {
      console.log('🗺️ Starting Maps data extraction for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'extractMapsData',
        url: url
      });

      if (response.success) {
        console.log('✅ Maps data extraction successful');
        this.state.extractionError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
      } else {
        console.error('❌ Maps data extraction failed:', response.error);
        this.state.extractionError = response.error;
        
        // Reset error after 5 seconds
        setTimeout(() => {
          this.state.extractionError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Maps data extraction error:', error);
      this.state.extractionError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset error after 5 seconds
      setTimeout(() => {
        this.state.extractionError = null;
      }, 5000);
    } finally {
      this.state.isExtracting = false;
    }
  }

  // Control Maps functionality with optional refresh callback
  async handleControlMaps(url: string | null, command: MapsControlCommand, onSuccess?: () => void) {
    if (!url || this.state.isControlling) {
      return;
    }

    this.state.isControlling = true;
    this.state.controlError = null;

    try {
      console.log('🗺️ Starting Maps control for:', url, 'Command:', command);
      
      const response = await chrome.runtime.sendMessage({
        action: 'controlMaps',
        url: url,
        command: command
      });

      if (response.success) {
        console.log('✅ Maps control successful:', response.result);
        this.state.controlError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
      } else {
        console.error('❌ Maps control failed:', response.error);
        this.state.controlError = response.error;
        
        // Reset error after 5 seconds
        setTimeout(() => {
          this.state.controlError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Maps control error:', error);
      this.state.controlError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset error after 5 seconds
      setTimeout(() => {
        this.state.controlError = null;
      }, 5000);
    } finally {
      this.state.isControlling = false;
    }
  }

  // Convenience methods for common Maps operations
  async zoomIn(url: string | null, onSuccess?: () => void): Promise<void> {
    return this.handleControlMaps(url, { action: 'zoom_in' }, onSuccess);
  }

  async zoomOut(url: string | null, onSuccess?: () => void): Promise<void> {
    return this.handleControlMaps(url, { action: 'zoom_out' }, onSuccess);
  }

  async search(url: string | null, query: string, onSuccess?: () => void): Promise<void> {
    return this.handleControlMaps(url, { 
      action: 'search', 
      params: { query } 
    }, onSuccess);
  }

  async getDirections(url: string | null, destination: string, origin?: string, onSuccess?: () => void): Promise<void> {
    return this.handleControlMaps(url, { 
      action: 'get_directions', 
      params: { destination, origin } 
    }, onSuccess);
  }

  async changeMapType(url: string | null, mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain', onSuccess?: () => void): Promise<void> {
    return this.handleControlMaps(url, { 
      action: 'change_map_type', 
      params: { mapType } 
    }, onSuccess);
  }

  async panTo(url: string | null, coordinates: { lat: number; lng: number }, onSuccess?: () => void): Promise<void> {
    return this.handleControlMaps(url, { 
      action: 'pan_to', 
      params: { coordinates } 
    }, onSuccess);
  }

  async clearDirections(url: string | null, onSuccess?: () => void): Promise<void> {
    return this.handleControlMaps(url, { 
      action: 'clear_directions' 
    }, onSuccess);
  }

  // Reset Maps manager state
  reset() {
    this.state.isExtracting = false;
    this.state.isControlling = false;
    this.state.extractionError = null;
    this.state.controlError = null;
  }

  // Check if current URL is Google Maps
  isGoogleMapsUrl(url: string | null): boolean {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return (urlObj.hostname === 'maps.google.com' || urlObj.hostname === 'www.google.com') && 
             (urlObj.pathname.includes('/maps') || urlObj.pathname === '/maps');
    } catch {
      return false;
    }
  }

  // Parse command from natural language text
  parseCommand(text: string): MapsControlCommand | null {
    const lowerText = text.toLowerCase().trim();
    
    // Zoom commands
    if (lowerText.includes('zoom in') || lowerText.includes('zoom +')) {
      return { action: 'zoom_in' };
    }
    if (lowerText.includes('zoom out') || lowerText.includes('zoom -')) {
      return { action: 'zoom_out' };
    }
    
    // Search commands
    if (lowerText.startsWith('search for ') || lowerText.startsWith('find ')) {
      const query = lowerText.replace(/^(search for |find )/, '');
      return { action: 'search', params: { query } };
    }
    
    // Directions commands
    if (lowerText.startsWith('directions to ') || lowerText.startsWith('navigate to ')) {
      const destination = lowerText.replace(/^(directions to |navigate to )/, '');
      return { action: 'get_directions', params: { destination } };
    }
    
    // Map type commands
    if (lowerText.includes('satellite view') || lowerText.includes('satellite mode')) {
      return { action: 'change_map_type', params: { mapType: 'satellite' } };
    }
    if (lowerText.includes('road view') || lowerText.includes('road mode') || lowerText.includes('default view')) {
      return { action: 'change_map_type', params: { mapType: 'roadmap' } };
    }
    if (lowerText.includes('terrain view') || lowerText.includes('terrain mode')) {
      return { action: 'change_map_type', params: { mapType: 'terrain' } };
    }
    if (lowerText.includes('hybrid view') || lowerText.includes('hybrid mode')) {
      return { action: 'change_map_type', params: { mapType: 'hybrid' } };
    }
    
    return null;
  }
}

// Export singleton instance
export const mapsManager = new MapsManager(); 