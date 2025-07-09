

import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';

// Handle manual content setting
export async function handleManualContentSetting(url: string, data: Partial<TabData>, sendResponse: (response: any) => void) {
  try {
    console.log('📝 Setting manual content for URL:', url);

    const success = await backgroundDataController.saveData(url, data);

    if (success) {
      console.log('✅ Manual content saved successfully');
      sendResponse({ success: true });
    } else {
      console.error('❌ Failed to save manual content');
      sendResponse({ success: false, error: 'Failed to save manual content' });
    }
  } catch (error) {
    console.error('❌ Error setting manual content:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}