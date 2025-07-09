export interface ThreadgirlRequest {
  url: string;
  content: string;
  prompt: string;
  model?: string;
  useCache?: boolean;
} 