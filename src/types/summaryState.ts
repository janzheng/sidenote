import type { SummaryStatus } from './summaryStatus';

export interface SummaryState {
  isGenerating: boolean;
  summaryStatus: SummaryStatus;
  summaryError: string | null;
} 