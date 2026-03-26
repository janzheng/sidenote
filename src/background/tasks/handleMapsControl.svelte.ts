import { backgroundDataController } from '../index';
import type { MapsControlCommand } from '../../types/mapsData';

export async function handleMapsControl(url: string, command: MapsControlCommand, sendResponse: (response: any) => void) {
  try {
    console.log('🗺️ Starting Maps control for URL:', url, 'Command:', command);

    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({
        success: false,
        error: 'No content data found for this URL. Please extract content first.'
      });
      return;
    }

    console.log('🗺️ Current mapsData status:', tabData.processing?.mapsData);

    await backgroundDataController.saveData(url, {
      processing: { mapsData: { isExtracting: false, isControlling: true, error: null } }
    });

    // Find the Maps tab
    const mapsTab = await findMapsTab(url);

    if (!mapsTab || !mapsTab.id) {
      console.error('❌ No Google Maps tabs found');
      await backgroundDataController.saveData(url, {
        processing: { mapsData: { isExtracting: false, isControlling: false, error: 'No Google Maps tabs found' } }
      });
      sendResponse({
        success: false,
        error: 'No Google Maps tabs found. Please open Google Maps first.'
      });
      return;
    }

    // Send control command to Maps content script
    let response: any;
    try {
      response = await chrome.tabs.sendMessage(mapsTab.id, {
        action: 'controlMaps',
        command: command
      });
    } catch (err) {
      console.error('❌ Maps content script not available:', err);
      await backgroundDataController.saveData(url, {
        processing: { mapsData: { isExtracting: false, isControlling: false, error: 'Maps content script not available' } }
      });
      sendResponse({
        success: false,
        error: 'Maps content script not available. Please refresh Google Maps and try again.'
      });
      return;
    }

    if (response?.success) {
      await backgroundDataController.saveData(url, {
        processing: { mapsData: { isExtracting: false, isControlling: false, error: null } }
      });
      console.log('✅ Maps control completed successfully:', response);
      sendResponse({
        success: true,
        result: response.result,
        action: response.action
      });
    } else {
      await backgroundDataController.saveData(url, {
        processing: { mapsData: { isExtracting: false, isControlling: false, error: response?.error || 'Unknown control error' } }
      });
      console.error('❌ Maps control failed:', response?.error);
      sendResponse({
        success: false,
        error: response?.error || 'Failed to control Maps',
        action: response?.action || command.action
      });
    }

  } catch (error) {
    console.error('❌ Handle Maps control error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await backgroundDataController.saveData(url, {
      processing: { mapsData: { isExtracting: false, isControlling: false, error: errorMessage } }
    });
    sendResponse({ success: false, error: errorMessage });
  }
}

async function findMapsTab(url: string): Promise<chrome.tabs.Tab | undefined> {
  const isCurrentUrlMaps = url.includes('maps.google.com') || url.includes('google.com/maps');

  if (isCurrentUrlMaps) {
    // Try exact URL match first
    const exactTabs = await chrome.tabs.query({ url: url });
    if (exactTabs.length > 0) {
      console.log('🗺️ Using exact tab match:', exactTabs[0].url);
      return exactTabs[0];
    }

    // Try active tab in current window
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0) {
      const activeTab = activeTabs[0];
      if (activeTab.url?.includes('maps.google.com') || activeTab.url?.includes('www.google.com/maps')) {
        console.log('🗺️ Using active Maps tab');
        return activeTab;
      }
    }
  }

  // Search all Maps tabs by pattern
  const urlPatterns = [
    '*://maps.google.com/*',
    '*://www.google.com/maps*',
    '*://google.com/maps*'
  ];

  for (const pattern of urlPatterns) {
    const mapsTabs = await chrome.tabs.query({ url: pattern });
    console.log(`🗺️ Pattern "${pattern}" found ${mapsTabs.length} tabs`);
    if (mapsTabs.length > 0) {
      console.log('🗺️ Found Maps tabs:', mapsTabs.map(t => t.url));
      return mapsTabs[0];
    }
  }

  return undefined;
}

export async function getMapsControlStatus(url: string): Promise<any> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      return { isControlling: false, error: null };
    }
    return {
      isControlling: tabData.processing?.mapsData?.isControlling || false,
      error: tabData.processing?.mapsData?.error || null
    };
  } catch (error) {
    console.error('Failed to get Maps control status:', error);
    return {
      isControlling: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
