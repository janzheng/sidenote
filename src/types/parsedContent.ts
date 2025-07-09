import type { ContentNode } from './contentNode';

export interface ParsedContent {
  contentStructure: {
    root: {
      children: ContentNode[];
    };
    stats: {
      totalNodes: number;
      headerCount: number;
      contentSections: number;
      maxDepth: number;
    };
  } | null;
  error: string | null;
} 