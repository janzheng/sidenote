export interface TabData {
  content: {
    url: string;
    text: string;
    html: string;
    markdown: string;
    title: string;
    metadata: PageMetadata;
    wordCount: number;
    extractedAt: number;
  };
  
  analysis: {
    summary: string | null;
    citations: CitationData | null;
    researchPaper: ResearchPaperAnalysis | null;
    contentStructure: ContentGraph | null;
  };
  
  processing: {
    summary: { isStreaming: boolean; error: string | null };
    citations: { isGenerating: boolean; error: string | null };
    researchPaper: { isExtracting: boolean; progress: string; error: string | null };
  };
  
  meta: {
    contentId: string;
    lastUpdated: number;
    activeTabIds: Set<number>;
    version: string;
  };
}
