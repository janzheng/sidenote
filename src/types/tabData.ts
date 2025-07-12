import type { PageMetadata } from './pageMetadata';
import type { CitationData } from './citations';
import type { ResearchPaperAnalysis } from './researchPaper';
import type { ContentGraph } from './contentGraph';
import type { ChatMessage } from './chatMessage';
import type { ThreadgirlResult } from './threadgirlResult';
import type { PageAssets } from './pageAssets';
import type { Recipe } from './recipe';
import type { SocialMediaThread } from './socialMedia';
import type { TextToSpeech } from './textToSpeech';
import type { MapsData } from './mapsData';

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
    chatMessages: ChatMessage[] | null;
    threadgirlResults: ThreadgirlResult[] | null;
    pageAssets: PageAssets | null;
    recipe: Recipe | null;
    socialMediaThread: SocialMediaThread | null;
    textToSpeech: TextToSpeech | null;
    mapsData: MapsData | null;
  };

  statuses: {
    bookmarkStatus: 'not-bookmarked' | 'success' | 'error';
  };
  
  processing: {
    summary: { isStreaming: boolean; error: string | null };
    citations: { isGenerating: boolean; error: string | null };
    researchPaper: { isExtracting: boolean; progress: string; error: string | null };
    chat: { isGenerating: boolean; error: string | null };
    threadgirl: { isProcessing: boolean; error: string | null };
    pageAssets: { isExtracting: boolean; error: string | null };
    recipe: { isExtracting: boolean; error: string | null };
    socialMediaThread: { isExtracting: boolean; isExpanding: boolean; error: string | null };
    textToSpeech: { isGenerating: boolean; error: string | null };
    mapsData: { isExtracting: boolean; isControlling: boolean; error: string | null };
  };
  
  meta: {
    contentId: string;
    lastUpdated: number;
    activeTabIds: Set<number>;
    version: string;
  };
}
