
export interface PageContent {
  url: string;
  cleanUrl: string;
  title: string;
  text: string;
  html?: string;
  // Add htmlkit outputs
  markdown?: string;
  htmlFigures?: Array<{
    figureNumber?: string;
    caption?: string;
    src?: string;
    alt?: string;
    title?: string;
    element: string;
  }>;
  wordCount: number;
  domain: string;
  contentType: 'webpage' | 'pdf' | 'research_paper' | 'news_article' | 'blog_post' | 'documentation' | 'image' | 'other';
  metadata?: PageMetadata;
  chunks?: ContentChunk[];
}