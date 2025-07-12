import { backgroundDataController } from '../index';

export async function handleMapsExtraction(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🗺️ Starting Maps data extraction for URL:', url);

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
    
    // Set extraction status to true
    await backgroundDataController.saveData(url, {
      processing: { 
        mapsData: { isExtracting: true, isControlling: false, error: null }
      }
    });

    // Helper function to extract from a specific tab
    async function extractFromTab(tab: chrome.tabs.Tab, actualUrl: string) {
      if (!tab.id) {
        console.error('❌ Tab ID not found');
        
        await backgroundDataController.saveData(url, {
          processing: { 
            mapsData: { isExtracting: false, isControlling: false, error: 'Tab ID not found' }
          }
        });
        
        sendResponse({ 
          success: false, 
          error: 'Tab ID not found' 
        });
        return;
      }

      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { action: 'extractMapsData' }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Content script not available:', chrome.runtime.lastError.message);
          
          await backgroundDataController.saveData(url, {
            processing: { 
              mapsData: { isExtracting: false, isControlling: false, error: 'Content script not available' }
            }
          });
          
          sendResponse({ 
            success: false, 
            error: 'Content script not available. Please refresh the page and try again.' 
          });
          return;
        }

        if (response?.success && response?.data) {
          // Save the Maps data to TabData using the original URL for data storage
          const saveResult = await backgroundDataController.saveData(url, {
            analysis: { 
              mapsData: response.data
            },
            processing: { 
              mapsData: { isExtracting: false, isControlling: false, error: null }
            }
          });
          
          console.log('🗺️ Save result:', saveResult);
          
          // Verify the save by loading the data again
          const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
          console.log('🗺️ Verified Maps data after save:', {
            hasMapsData: !!verifyData?.analysis?.mapsData,
            hasLocation: !!verifyData?.analysis?.mapsData?.currentLocation,
            searchQuery: verifyData?.analysis?.mapsData?.searchQuery,
            resultsCount: verifyData?.analysis?.mapsData?.searchResults?.length || 0,
            hasRoute: !!verifyData?.analysis?.mapsData?.currentRoute,
            actualTabUrl: actualUrl
          });

          console.log('✅ Maps data extraction completed successfully');
          sendResponse({ 
            success: true, 
            data: response.data
          });
        } else {
          await backgroundDataController.saveData(url, {
            processing: { 
              mapsData: { isExtracting: false, isControlling: false, error: response?.error || 'Unknown error' }
            }
          });
          
          console.error('❌ Maps data extraction failed:', response?.error);
          sendResponse({ 
            success: false, 
            error: response?.error || 'Failed to extract Maps data' 
          });
        }
      });
    }

    // Send message to content script to extract Maps data
    // First try exact URL match
    chrome.tabs.query({ url: url }, async (tabs) => {
      if (tabs.length > 0) {
        // Use exact match tab
        const tab = tabs[0];
        console.log(`🗺️ Found exact URL match: ${tab.url}`);
        await extractFromTab(tab, url);
        return;
      }

      // If no exact match, try to find Google Maps tabs by pattern
      console.log('🔍 No exact URL match, searching for Google Maps tabs...');
      
      chrome.tabs.query({}, async (allTabs) => {
        const mapsTabs = allTabs.filter(tab => 
          tab.url && (
            tab.url.includes('maps.google.com') || 
            (tab.url.includes('google.com') && tab.url.includes('/maps'))
          )
        );
        
        if (mapsTabs.length === 0) {
          console.error('❌ No Google Maps tabs found');
          
          await backgroundDataController.saveData(url, {
            processing: { 
              mapsData: { isExtracting: false, isControlling: false, error: 'No Google Maps tab found. Please ensure Google Maps is open.' }
            }
          });
          
          sendResponse({ 
            success: false, 
            error: 'No Google Maps tab found. Please ensure Google Maps is open.' 
          });
          return;
        }
        
        // Use the first (most recently active) Google Maps tab
        const tab = mapsTabs[0];
        console.log(`🗺️ Found Google Maps tab: ${tab.url}`);
        
        // Continue with extraction using the found tab
        await extractFromTab(tab, tab.url || url);
      });
    });

  } catch (error) {
    console.error('❌ Handle Maps extraction error:', error);
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

export async function getMapsDataStatus(url: string): Promise<any> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      return {
        hasMapsData: false,
        isExtracting: false,
        isControlling: false,
        error: null
      };
    }

    return {
      hasMapsData: !!tabData.analysis?.mapsData,
      isExtracting: tabData.processing?.mapsData?.isExtracting || false,
      isControlling: tabData.processing?.mapsData?.isControlling || false,
      error: tabData.processing?.mapsData?.error || null,
      mapsData: tabData.analysis?.mapsData || null
    };
  } catch (error) {
    console.error('Failed to get Maps data status:', error);
    return {
      hasMapsData: false,
      isExtracting: false,
      isControlling: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 