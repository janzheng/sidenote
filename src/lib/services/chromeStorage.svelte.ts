/**
 * Chrome Storage Service
 * Provides a clean interface for chrome.storage.local operations
 */

export interface ChromeStorageService {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<boolean>;
  getMultiple(keys: string[]): Promise<Record<string, any>>;
  setMultiple(data: Record<string, any>): Promise<boolean>;
  remove(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  getAll(): Promise<Record<string, any>>;
  clearTabData(): Promise<boolean>;
}

class ChromeStorageImpl implements ChromeStorageService {
  async get(key: string): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(key);
        return result[key];
      } catch (error) {
        console.error(`Failed to get ${key} from chrome.storage:`, error);
        return undefined;
      }
    }
    return undefined;
  }

  async set(key: string, value: any): Promise<boolean> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.local.set({ [key]: value });
        return true;
      } catch (error) {
        console.error(`Failed to set ${key} in chrome.storage:`, error);
        return false;
      }
    }
    return false;
  }

  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(keys);
        return result;
      } catch (error) {
        console.error(`Failed to get multiple keys from chrome.storage:`, error);
        return {};
      }
    }
    return {};
  }

  async setMultiple(data: Record<string, any>): Promise<boolean> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.local.set(data);
        return true;
      } catch (error) {
        console.error(`Failed to set multiple keys in chrome.storage:`, error);
        return false;
      }
    }
    return false;
  }

  async remove(key: string): Promise<boolean> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.local.remove(key);
        return true;
      } catch (error) {
        console.error(`Failed to remove ${key} from chrome.storage:`, error);
        return false;
      }
    }
    return false;
  }

  async clear(): Promise<boolean> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.local.clear();
        return true;
      } catch (error) {
        console.error(`Failed to clear chrome.storage:`, error);
        return false;
      }
    }
    return false;
  }

  async getAll(): Promise<Record<string, any>> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(null);
        return result;
      } catch (error) {
        console.error('Failed to get all data from chrome.storage:', error);
        return {};
      }
    }
    return {};
  }

  async clearTabData(): Promise<boolean> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        // Get all storage data
        const allData = await chrome.storage.local.get(null);
        
        // Filter out tab-specific data (keep settings)
        const keysToRemove = Object.keys(allData).filter(key => 
          !key.startsWith('sidenote_') // Keep settings that start with sidenote_
        );
        
        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
        }
        
        return true;
      } catch (error) {
        console.error('Failed to clear tab data from chrome.storage:', error);
        return false;
      }
    }
    return false;
  }
}

export const chromeStorage = new ChromeStorageImpl(); 