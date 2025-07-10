export interface CitationData {
  bibtex: string;
  apa: string;
  vancouver: string;
  harvard: string;
  chicago?: string;
  mla?: string;
}

export interface CitationResult {
  success: boolean;
  citations?: CitationData;
  error?: string;
  source?: string; // 'doi' | 'url' | 'metadata' | 'ai' | 'manual-url' | 'enhanced-metadata' | 'pdf-content-enhanced'
  generatedAt?: number;
  extractionMethod?: string; // For PDF citation extraction method tracking
  confidence?: number; // Confidence score for extracted citations
} 