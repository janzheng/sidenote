import type { PageMetadata } from './pageMetadata';
import type { CitationData } from './citations';
import type { ResearchPaperAnalysis } from './researchPaper';
import type { ContentGraph } from './contentGraph';

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

  statuses: {
    bookmarkStatus: 'not-bookmarked' | 'success' | 'error';
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
