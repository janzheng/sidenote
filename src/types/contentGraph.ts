import type { ContentNode } from './contentNode';

export interface ContentGraph {
  root: ContentNode;
  nodes: Map<string, ContentNode>; // id -> node lookup
  flatNodes: ContentNode[]; // flattened array for easy iteration
  headerLevels: Map<number, ContentNode[]>; // level -> headers at that level
  stats: {
    totalNodes: number;
    headerCount: number;
    contentSections: number;
    maxDepth: number;
    wordCount: number;
  };
} 