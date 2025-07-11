import type { TextToSpeech } from './textToSpeech';

export interface TtsResponse {
  success: boolean;
  error?: string;
  textToSpeech?: TextToSpeech;
  audioBlob?: Blob;
  audioUrl?: string;
}

export interface TtsRewriteResponse {
  success: boolean;
  error?: string;
  rewrittenText?: string;
}

export interface TtsAudioResponse {
  success: boolean;
  error?: string;
  audioBlob?: Blob;
  audioUrl?: string;
} 