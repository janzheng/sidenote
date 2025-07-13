import { mapsManager } from '../../../ui/mapsManager.svelte';

// Get current active Google Maps tab URL
export async function getCurrentMapsTabUrl(): Promise<string | null> {
  try {
    // First try to get active tab in current window
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url && mapsManager.isGoogleMapsUrl(tabs[0].url)) {
      console.log('🗺️ Found active Maps tab:', tabs[0].url);
      return tabs[0].url;
    }
    
    // If active tab is not Maps, look for any Google Maps tabs
    const allTabs = await chrome.tabs.query({});
    const mapsTabs = allTabs.filter(tab => 
      tab.url && mapsManager.isGoogleMapsUrl(tab.url)
    );
    
    if (mapsTabs.length > 0 && mapsTabs[0].url) {
      console.log('🗺️ Found Maps tab:', mapsTabs[0].url);
      return mapsTabs[0].url;
    }
    
    console.log('🗺️ No active Maps tabs found');
    return null;
  } catch (error) {
    console.error('❌ Failed to get current Maps tab:', error);
    return null;
  }
}

// Get Maps data for context
export async function getMapsData(url: string): Promise<any> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getMapsDataStatus',
      url: url
    });

    if (response.success && response.status && response.status.mapsData) {
      return response.status.mapsData;
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to get Maps data:', error);
    return null;
  }
} 