import type { TabData } from '../../types/tabData';
import type { ScreenshotInfo } from '../../types/pageAssets';
import { getCurrentSettings } from '../ui/settings.svelte';

export interface JinaResponse {
  success: boolean;
  screenshots?: ScreenshotInfo;
  error?: string;
}

export interface JinaValidationResult {
  isValid: boolean;
  message?: string;
}

export class JinaService {

  /**
   * Validate that required settings are configured for Jina API
   */
  static validateSettings(): JinaValidationResult {
    const settings = getCurrentSettings();
    
    if (!settings.jinaApiKey || settings.jinaApiKey.trim().length === 0) {
      return { 
        isValid: false, 
        message: 'Jina API key is required. Please configure it in settings.' 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validate URL for Jina API (only HTTP/HTTPS supported)
   */
  static validateUrl(url: string): JinaValidationResult {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return {
        isValid: false,
        message: 'Invalid URL protocol for Jina. Only HTTP/HTTPS URLs are supported.'
      };
    }
    return { isValid: true };
  }

  /**
   * Generate pageshot using Jina API
   */
  static async generatePageshot(url: string): Promise<JinaResponse> {
    try {
      console.log('📸 Starting pageshot generation for URL:', url);

      // Validate settings first
      const settingsValidation = this.validateSettings();
      if (!settingsValidation.isValid) {
        return {
          success: false,
          error: settingsValidation.message
        };
      }

      // Validate URL
      const urlValidation = this.validateUrl(url);
      if (!urlValidation.isValid) {
        return {
          success: false,
          error: urlValidation.message
        };
      }

      const settings = getCurrentSettings();
      
      // Build headers object conditionally
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-Return-Format': 'pageshot'
      };
      
      // Only add Authorization header if apiKey exists
      if (settings.jinaApiKey) {
        headers['Authorization'] = `Bearer ${settings.jinaApiKey}`;
      }
      
      const response = await fetch(`https://r.jina.ai/${url}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Jina pageshot API request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        return {
          success: false,
          error: `Jina pageshot API request failed: ${response.status} ${response.statusText}`
        };
      }

      // Jina returns JSON response with structured data
      const jsonResponse = await response.json();
      console.log('📋 Jina pageshot JSON response:', jsonResponse);
      
      // Extract the pageshot URL from the response
      const pageshotUrl = jsonResponse?.data?.pageshotUrl || jsonResponse?.data?.screenshotUrl || '';
      
      if (!pageshotUrl) {
        console.error('❌ No pageshotUrl found in Jina pageshot response:', jsonResponse);
        return {
          success: false,
          error: 'No pageshot URL found in Jina pageshot response'
        };
      }
      
      console.log('✅ Jina pageshot successful, image URL received:', pageshotUrl);
      return {
        success: true,
        screenshots: {
          pageshot: pageshotUrl.trim(),
          capturedAt: Date.now()
        }
      };

    } catch (error) {
      console.error('❌ Jina pageshot request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Jina pageshot error'
      };
    }
  }

  /**
   * Generate screenshot using Jina API
   */
  static async generateScreenshot(url: string): Promise<JinaResponse> {
    try {
      console.log('📷 Starting screenshot generation for URL:', url);

      // Validate settings first
      const settingsValidation = this.validateSettings();
      if (!settingsValidation.isValid) {
        return {
          success: false,
          error: settingsValidation.message
        };
      }

      // Validate URL
      const urlValidation = this.validateUrl(url);
      if (!urlValidation.isValid) {
        return {
          success: false,
          error: urlValidation.message
        };
      }

      const settings = getCurrentSettings();

      // Build headers object conditionally
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-Return-Format': 'screenshot'
      };

      // Only add Authorization header if apiKey exists
      if (settings.jinaApiKey) {
        headers['Authorization'] = `Bearer ${settings.jinaApiKey}`;
      }

      const response = await fetch(`https://r.jina.ai/${url}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Jina screenshot API request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        return {
          success: false,
          error: `Jina screenshot API request failed: ${response.status} ${response.statusText}`
        };
      }

      // Jina returns JSON response with structured data
      const jsonResponse = await response.json();
      console.log('📋 Jina screenshot JSON response:', jsonResponse);
      
      // Extract the screenshot URL from the response
      const screenshotUrl = jsonResponse?.data?.screenshotUrl || '';
      
      if (!screenshotUrl) {
        console.error('❌ No screenshotUrl found in Jina screenshot response:', jsonResponse);
        return {
          success: false,
          error: 'No screenshot URL found in Jina screenshot response'
        };
      }
      
      console.log('✅ Jina screenshot successful, image URL received:', screenshotUrl);
      return {
        success: true,
        screenshots: {
          screenshot: screenshotUrl.trim(),
          capturedAt: Date.now()
        }
      };

    } catch (error) {
      console.error('❌ Jina screenshot request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Jina screenshot error'
      };
    }
  }
} 