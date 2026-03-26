import { backgroundDataController } from '../index';

export async function handleMapsExtraction(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🗺️ Starting Maps data extraction for URL:', url);

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
      processing: { mapsData: { isExtracting: true, isControlling: false, error: null } }
    });

    // Find the right tab — try exact URL match first, then any Maps tab
    let tab: chrome.tabs.Tab | undefined;

    const exactTabs = await chrome.tabs.query({ url: url });
    if (exactTabs.length > 0) {
      tab = exactTabs[0];
      console.log(`🗺️ Found exact URL match: ${tab.url}`);
    } else {
      console.log('🔍 No exact URL match, searching for Google Maps tabs...');
      const allTabs = await chrome.tabs.query({});
      const mapsTabs = allTabs.filter(t =>
        t.url && (
          t.url.includes('maps.google.com') ||
          (t.url.includes('google.com') && t.url.includes('/maps'))
        )
      );

      if (mapsTabs.length > 0) {
        tab = mapsTabs[0];
        console.log(`🗺️ Found Google Maps tab: ${tab.url}`);
      }
    }

    if (!tab || !tab.id) {
      console.error('❌ No Google Maps tabs found');
      await backgroundDataController.saveData(url, {
        processing: { mapsData: { isExtracting: false, isControlling: false, error: 'No Google Maps tab found. Please ensure Google Maps is open.' } }
      });
      sendResponse({
        success: false,
        error: 'No Google Maps tab found. Please ensure Google Maps is open.'
      });
      return;
    }

    // Send message to content script
    let response: any;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractMapsData' });
    } catch (err) {
      console.error('❌ Content script not available:', err);
      await backgroundDataController.saveData(url, {
        processing: { mapsData: { isExtracting: false, isControlling: false, error: 'Content script not available' } }
      });
      sendResponse({
        success: false,
        error: 'Content script not available. Please refresh the page and try again.'
      });
      return;
    }

    if (response?.success && response?.data) {
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { mapsData: response.data },
        processing: { mapsData: { isExtracting: false, isControlling: false, error: null } }
      });

      console.log('🗺️ Save result:', saveResult);

      const verifyData = await backgroundDataController.loadData(url, true);
      console.log('🗺️ Verified Maps data after save:', {
        hasMapsData: !!verifyData?.analysis?.mapsData,
        hasLocation: !!verifyData?.analysis?.mapsData?.currentLocation,
        searchQuery: verifyData?.analysis?.mapsData?.searchQuery,
        resultsCount: verifyData?.analysis?.mapsData?.searchResults?.length || 0,
        hasRoute: !!verifyData?.analysis?.mapsData?.currentRoute,
        actualTabUrl: tab.url || url
      });

      console.log('✅ Maps data extraction completed successfully');
      sendResponse({ success: true, data: response.data });
    } else {
      await backgroundDataController.saveData(url, {
        processing: { mapsData: { isExtracting: false, isControlling: false, error: response?.error || 'Unknown error' } }
      });
      console.error('❌ Maps data extraction failed:', response?.error);
      sendResponse({
        success: false,
        error: response?.error || 'Failed to extract Maps data'
      });
    }

  } catch (error) {
    console.error('❌ Handle Maps extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await backgroundDataController.saveData(url, {
      processing: { mapsData: { isExtracting: false, isControlling: false, error: errorMessage } }
    });
    sendResponse({ success: false, error: errorMessage });
  }
}

export async function getMapsDataStatus(url: string): Promise<any> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      return { hasMapsData: false, isExtracting: false, isControlling: false, error: null };
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
