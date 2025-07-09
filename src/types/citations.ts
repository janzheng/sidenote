export interface CitationData {
  citations: Array<{
    text: string;
    source: string;
    url?: string;
    type: 'quote' | 'paraphrase' | 'reference';
  }>;
  generatedAt: number;
} 