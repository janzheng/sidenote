import type { AgentContent } from '../registry.svelte';

// Tool function signature
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  func: (params: any, signal?: AbortSignal) => Promise<AgentContent | AgentContent[]>;
} 