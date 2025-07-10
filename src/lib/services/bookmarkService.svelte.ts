import type { TabData } from '../../types/tabData';
import type { Settings } from '../../types/settings';
import type { SheetBookmarkData, BookmarkResponse, BookmarkValidationResult } from '../../types/bookmark';
import { getCurrentSettings } from '../ui/settings.svelte';

export class BookmarkService {
  private static readonly BOOKMARK_API_URL = 'https://yawnxyz-sheetlogserver.web.val.run/api/bookmark';
  private static readonly TIMEOUT = 30000; // 30 seconds

  /**
   * Convert TabData to the format expected by the sheet bookmark API
   */
  private static prepareBookmarkData(tabData: TabData): SheetBookmarkData {
    return {
      url: tabData.content.url,
      title: tabData.content.title,
      content: tabData.content.markdown
    };
  }

  /**
   * Validate that required settings are configured
   */
  static validateSettings(): BookmarkValidationResult {
    const settings = getCurrentSettings();
    
    if (!settings.sheetUrl || settings.sheetUrl.trim().length === 0) {
      return {
        isValid: false,
        message: 'Sheet URL is required. Please configure it in settings.'
      };
    }

    if (!settings.sheetName || settings.sheetName.trim().length === 0) {
      return {
        isValid: false,
        message: 'Sheet Name is required. Please configure it in settings.'
      };
    }

    // Basic URL validation
    try {
      new URL(settings.sheetUrl);
    } catch {
      return {
        isValid: false,
        message: 'Sheet URL must be a valid URL.'
      };
    }

    return { isValid: true };
  }

  /**
   * Bookmark a page using TabData
   */
  static async bookmarkTabData(tabData: TabData): Promise<BookmarkResponse> {
    try {
      console.log('🔖 Starting bookmark process for TabData:', tabData.content.url);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const settings = getCurrentSettings();
      const bookmarkData = this.prepareBookmarkData(tabData);

      // Prepare the request payload
      const payload = {
        sheetUrl: settings.sheetUrl,
        sheetName: settings.sheetName,
        url: bookmarkData.url,
        title: bookmarkData.title,
        content: bookmarkData.content
      };

      console.log('🌐 Sending bookmark request to sheet API:', payload);

      // Make the API request WITHOUT timeout or AbortController
      let response;
      try {
        response = await fetch(this.BOOKMARK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (fetchError) {
        console.error('❌ Fetch threw an error:', fetchError);
        throw fetchError;
      }

      console.log('🌐 Got response:', response);

      const text = await response.text();
      console.log('🌐 Response text:', text);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${text}`
        };
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (jsonError) {
        console.error('❌ Failed to parse JSON:', jsonError, text);
        throw jsonError;
      }
      
      console.log('✅ Bookmark API response:', result);

      return {
        success: true,
        message: result.message || 'Page bookmarked successfully',
        bookmarkId: result.id || `sheet_${Date.now()}`
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timed out' };
      }

      console.error('❌ Bookmark error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown bookmark error'
      };
    }
  }

} 