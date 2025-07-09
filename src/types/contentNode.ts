export interface ContentNode {
  id: string;
  type: 'header' | 'content' | 'list' | 'quote' | 'code' | 'root';
  level?: number; // 1-6 for headers (h1-h6)
  title?: string; // header text
  content?: string; // text content
  rawHtml?: string; // original HTML fragment
  markdown?: string; // markdown representation
  wordCount?: number;
  children: ContentNode[];
  parentId?: string; // id of parent node
  order: number; // position in document
} 