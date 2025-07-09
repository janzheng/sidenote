export interface BookmarkData {
  url: string;
  title: string;
  content: {
    text: string;
    markdown: string;
    wordCount: number;
  };
  metadata: {
    author?: string;
    description?: string;
    language?: string;
    publishedDate?: string;
    tags?: string[];
    bookmarkedAt?: string;
  };
  extractedAt: number;
  contentId: string;
}

// Sheet-specific bookmark data (simplified format for sheet API)
export interface SheetBookmarkData {
  url: string;
  title: string;
  content: string; // markdown content
}

export interface BookmarkResponse {
  success: boolean;
  message?: string;
  error?: string;
  bookmarkId?: string;
}

// Validation result interface
export interface BookmarkValidationResult {
  isValid: boolean;
  message?: string;
}