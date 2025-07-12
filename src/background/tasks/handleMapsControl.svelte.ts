import { backgroundDataController } from '../index';
import type { MapsControlCommand } from '../../types/mapsData';

export async function handleMapsControl(url: string, command: MapsControlCommand, sendResponse: (response: any) => void) {
  try {
    console.log('🗺️ Starting Maps control for URL:', url, 'Command:', command);

    // First, load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      });
      return;
    }

    // Log current mapsData status before update
    console.log('🗺️ Current mapsData status:', tabData.processing?.mapsData);
    
    // Set control status to true
    await backgroundDataController.saveData(url, {
      processing: { 
        mapsData: { isExtracting: false, isControlling: true, error: null }
      }
    });

    // Check if the current URL is already a Google Maps URL
    const isCurrentUrlMaps = url.includes('maps.google.com') || url.includes('www.google.com/maps');
    
    console.log('🗺️ URL analysis:', { url, isCurrentUrlMaps });
    
    if (isCurrentUrlMaps) {
      // If the current URL is Google Maps, first try to find the exact tab
      console.log('🗺️ Current URL is Maps, searching for exact tab match');
      
      chrome.tabs.query({ url: url }, async (exactTabs) => {
        console.log('🗺️ Exact URL match found:', exactTabs.length, 'tabs');
        
        if (exactTabs.length > 0) {
          const mapsTab = exactTabs[0];
          console.log('🗺️ Using exact tab match:', mapsTab.url);
          await sendControlToTab(mapsTab, command, url, sendResponse);
          return;
        }
        
        // If no exact match, try active tab in current window
        chrome.tabs.query({ active: true, currentWindow: true }, async (activeTabs) => {
          console.log('🗺️ Active tab query result:', activeTabs.length, 'tabs');
          
          if (activeTabs.length > 0) {
            const activeTab = activeTabs[0];
            console.log('🗺️ Active tab URL:', activeTab.url);
            
            if (activeTab.url?.includes('maps.google.com') || activeTab.url?.includes('www.google.com/maps')) {
              console.log('🗺️ Using active Maps tab');
              await sendControlToTab(activeTab, command, url, sendResponse);
              return;
            }
          }
          
          // Fallback to searching all Maps tabs
          console.log('🗺️ Falling back to general Maps tab search');
          await findAndControlMapsTabs(command, url, sendResponse);
        });
      });
    } else {
      // If current URL is not Maps, search for any Maps tabs
      console.log('🗺️ Current URL is not Maps, searching for any Maps tabs');
      await findAndControlMapsTabs(command, url, sendResponse);
    }

  } catch (error) {
    console.error('❌ Handle Maps control error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update processing status
    await backgroundDataController.saveData(url, {
      processing: { 
        mapsData: { isExtracting: false, isControlling: false, error: errorMessage }
      }
    });
    
    sendResponse({ success: false, error: errorMessage });
  }
}

async function findAndControlMapsTabs(command: MapsControlCommand, url: string, sendResponse: (response: any) => void) {
  // Try multiple URL patterns for Google Maps
  const urlPatterns = [
    '*://maps.google.com/*',
    '*://www.google.com/maps*',
    '*://google.com/maps*'
  ];
  
  console.log('🗺️ Searching for Maps tabs with patterns:', urlPatterns);
  
  for (const pattern of urlPatterns) {
    const mapsTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      chrome.tabs.query({ url: pattern }, (tabs) => {
        console.log(`🗺️ Pattern "${pattern}" found ${tabs.length} tabs`);
        resolve(tabs);
      });
    });
    
    if (mapsTabs.length > 0) {
      console.log('🗺️ Found Maps tabs:', mapsTabs.map(tab => tab.url));
      const mapsTab = mapsTabs[0];
      await sendControlToTab(mapsTab, command, url, sendResponse);
      return;
    }
  }
  
  // If no tabs found with any pattern
  console.error('❌ No Google Maps tabs found with any pattern');
  
  await backgroundDataController.saveData(url, {
    processing: { 
      mapsData: { isExtracting: false, isControlling: false, error: 'No Google Maps tabs found' }
    }
  });
  
  sendResponse({ 
    success: false, 
    error: 'No Google Maps tabs found. Please open Google Maps first.' 
  });
}

async function sendControlToTab(mapsTab: chrome.tabs.Tab, command: MapsControlCommand, url: string, sendResponse: (response: any) => void) {
  if (!mapsTab.id) {
    console.error('❌ Maps tab ID not found');
    
    await backgroundDataController.saveData(url, {
      processing: { 
        mapsData: { isExtracting: false, isControlling: false, error: 'Maps tab ID not found' }
      }
    });
    
    sendResponse({ 
      success: false, 
      error: 'Maps tab ID not found' 
    });
    return;
  }

  // Send control command to Maps content script
  chrome.tabs.sendMessage(mapsTab.id, { 
    action: 'controlMaps', 
    command: command 
  }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Maps content script not available:', chrome.runtime.lastError.message);
      
      await backgroundDataController.saveData(url, {
        processing: { 
          mapsData: { isExtracting: false, isControlling: false, error: 'Maps content script not available' }
        }
      });
      
      sendResponse({ 
        success: false, 
        error: 'Maps content script not available. Please refresh Google Maps and try again.' 
      });
      return;
    }

    if (response?.success) {
      // Update processing status to complete
      await backgroundDataController.saveData(url, {
        processing: { 
          mapsData: { isExtracting: false, isControlling: false, error: null }
        }
      });
      
      console.log('✅ Maps control completed successfully:', response);
      sendResponse({ 
        success: true, 
        result: response.result,
        action: response.action
      });
    } else {
      await backgroundDataController.saveData(url, {
        processing: { 
          mapsData: { isExtracting: false, isControlling: false, error: response?.error || 'Unknown control error' }
        }
      });
      
      console.error('❌ Maps control failed:', response?.error);
      sendResponse({ 
        success: false, 
        error: response?.error || 'Failed to control Maps',
        action: response?.action || command.action
      });
    }
  });
}

export async function getMapsControlStatus(url: string): Promise<any> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      return {
        isControlling: false,
        error: null
      };
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