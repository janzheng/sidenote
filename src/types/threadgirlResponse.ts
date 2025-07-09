import type { ThreadgirlResult } from './threadgirlResult';

export interface ThreadgirlResponse {
  success: boolean;
  result?: ThreadgirlResult;
  error?: string;
} 