export interface ThreadgirlResult {
  id: string;
  prompt: string;
  result: string;
  model: string;
  createdAt: number;
  title?: string; // Optional user-defined title for the writeup
} 