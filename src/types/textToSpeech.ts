export interface TextToSpeech {
  id: string;
  originalText: string;
  rewrittenText: string;
  audioUrl: string | null; // Not stored in Chrome storage, generated on-demand
  voice: string;
  model: string;
  generatedAt: number;
  wordCount: number;
  estimatedDuration?: number; // in seconds
}

export interface TextToSpeechOptions {
  voice?: string;
  model?: string;
  maxLength?: number;
} 