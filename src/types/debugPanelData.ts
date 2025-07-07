
export interface DebugPanelData {
  currentTabId: number | null;
  currentUrl: string;
  currentContentId: string;
  contentExists: boolean;
  textLength: number;
  wordCount: number;
  extractedAt: number | null;
  isExtracting: boolean;
  isLoading: boolean;
  isSaving: boolean;
  activeTabsForContent: number[];
  sameUrlTabs: { tabId: number; url: string }[];
} 