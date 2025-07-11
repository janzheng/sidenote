import type { TtsStatus } from './ttsStatus';

export interface TtsState {
  isGenerating: boolean;
  ttsStatus: TtsStatus;
  ttsError: string | null;
  selectedVoice: string;
} 