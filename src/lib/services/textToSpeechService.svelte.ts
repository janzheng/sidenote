import type { TabData } from '../../types/tabData';
import type { TtsResponse, TtsRewriteResponse, TtsAudioResponse } from '../../types/ttsResponse';
import type { TextToSpeech, TextToSpeechOptions } from '../../types/textToSpeech';
import { GroqService } from './groqService.svelte';
import { getCurrentSettings } from '../ui/settings.svelte';

export class TextToSpeechService {

  /**
   * Validate that required settings are configured for TTS
   */
  static validateSettings(): { isValid: boolean; message?: string } {
    const settings = getCurrentSettings();
    
    if (!settings.apiKey || settings.apiKey.trim().length === 0) {
      return { 
        isValid: false, 
        message: 'Groq API key is required. Please configure it in settings.' 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Rewrite text to be TTS-friendly using the specified model
   */
  static async rewriteTextForTTS(text: string, title?: string): Promise<TtsRewriteResponse> {
    try {
      console.log('🔊 Starting text rewriting for TTS, length:', text.length);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      // Create system prompt for TTS rewriting
      const systemPrompt = `You are an expert text editor specializing in preparing content for text-to-speech conversion. Your task is to rewrite text to be natural and pleasant when spoken aloud.

Your rewriting should:
1. Convert lists, bullet points, and fragmented text into complete, flowing sentences
2. Remove or simplify citations (e.g., "[1]", "(Smith et al., 2023)") - either remove them entirely or convert to natural speech like "according to Smith and colleagues"
3. Simplify complex tables by converting them to narrative descriptions
4. Remove URLs, email addresses, and other hard-to-pronounce elements
5. Convert abbreviations to full words (e.g., "etc." to "and so on", "e.g." to "for example")
6. Add natural transitions between sections to improve flow
7. Ensure numbers are written in a way that sounds natural when spoken
8. Remove excessive technical jargon or explain it in simpler terms
9. Break up very long sentences into shorter, more digestible ones
10. Maintain the core meaning and important information while making it speech-friendly

IMPORTANT: Return ONLY the rewritten content. Do not include any preamble, introduction, or explanation like "Here's a rewritten version..." or "The following is optimized for..." - just return the rewritten text directly.

The goal is to create text that sounds natural, engaging, and easy to understand when converted to audio, while preserving the essential content and meaning.`;

      // Create user prompt with the content
      const userPrompt = `${title ? `Title: ${title}\n\n` : ''}Content to rewrite for text-to-speech:

${text.substring(0, 120000)}${text.length > 120000 ? '...\n\n[Content truncated for length]' : ''}`;

      // Generate rewritten text using the specified model
      const response = await GroqService.generateTextFromPrompt(
        userPrompt,
        systemPrompt,
        {
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct', // Use the specified model
          temperature: 0.3,
          maxTokens: 4000,
          topP: 0.9
        }
      );

      if (response.success && response.content) {
        console.log('✅ Text rewriting successful');
        return {
          success: true,
          rewrittenText: response.content.trim()
        };
      } else {
        console.error('❌ Text rewriting failed:', response.error);
        return {
          success: false,
          error: response.error || 'Failed to rewrite text for TTS'
        };
      }

    } catch (error) {
      console.error('❌ Text rewriting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown text rewriting error'
      };
    }
  }

  /**
   * Split text into chunks that fit within Groq's character limit
   */
  static splitTextIntoChunks(text: string, maxChars: number = 9500): string[] {
    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence + '. ';
      
      // If adding this sentence would exceed the limit, save current chunk and start new one
      if (currentChunk.length + sentenceWithPunctuation.length > maxChars) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentenceWithPunctuation;
      } else {
        currentChunk += sentenceWithPunctuation;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Merge multiple audio blobs into a single blob
   */
  static async mergeAudioBlobs(audioBlobs: Blob[]): Promise<Blob> {
    if (audioBlobs.length === 1) {
      return audioBlobs[0];
    }

    // For WAV files, we need to properly concatenate them
    // This is a simplified approach - for production, you'd want proper WAV header handling
    const chunks: ArrayBuffer[] = [];
    
    for (const blob of audioBlobs) {
      const arrayBuffer = await blob.arrayBuffer();
      chunks.push(arrayBuffer);
    }

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return new Blob([combined], { type: 'audio/wav' });
  }

  /**
   * Generate audio from text using Groq TTS with chunking support
   */
  static async generateAudio(text: string, voice?: string): Promise<TtsAudioResponse> {
    try {
      console.log('🔊 Starting audio generation, text length:', text.length);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      // Split text into chunks if it's too long
      const chunks = this.splitTextIntoChunks(text);
      console.log('🔊 Text split into', chunks.length, 'chunks');

      if (chunks.length === 1) {
        // Single chunk - use GroqService directly
        const speechResult = await GroqService.generateSpeech(text, voice);

        if (speechResult.success && speechResult.audioBlob) {
          console.log('✅ Audio generation successful');
          return {
            success: true,
            audioBlob: speechResult.audioBlob
            // Note: No audioUrl here - will be created in the frontend where URL.createObjectURL is available
          };
        } else {
          console.error('❌ Audio generation failed:', speechResult.error);
          return {
            success: false,
            error: speechResult.error || 'Failed to generate audio'
          };
        }
      } else {
        // Multiple chunks - generate audio for each and merge
        console.log('🔊 Generating audio for', chunks.length, 'chunks...');
        const audioBlobs: Blob[] = [];

        for (let i = 0; i < chunks.length; i++) {
          console.log(`🔊 Processing chunk ${i + 1}/${chunks.length}, length:`, chunks[i].length);
          
          const chunkResult = await GroqService.generateSpeech(chunks[i], voice);
          
          if (chunkResult.success && chunkResult.audioBlob) {
            audioBlobs.push(chunkResult.audioBlob);
          } else {
            console.error(`❌ Failed to generate audio for chunk ${i + 1}:`, chunkResult.error);
            return {
              success: false,
              error: `Failed to generate audio for chunk ${i + 1}: ${chunkResult.error}`
            };
          }

          // Add a small delay between requests to be respectful to the API
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Merge all audio blobs
        console.log('🔊 Merging', audioBlobs.length, 'audio chunks...');
        const mergedBlob = await this.mergeAudioBlobs(audioBlobs);

        console.log('✅ Multi-chunk audio generation successful');
        return {
          success: true,
          audioBlob: mergedBlob
          // Note: No audioUrl here - will be created in the frontend where URL.createObjectURL is available
        };
      }

    } catch (error) {
      console.error('❌ Audio generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown audio generation error'
      };
    }
  }

  /**
   * Full TTS pipeline: rewrite text and generate audio
   */
  static async generateTextToSpeech(
    tabData: TabData, 
    options: TextToSpeechOptions = {}
  ): Promise<TtsResponse> {
    try {
      console.log('🔊 Starting full TTS pipeline for TabData:', tabData.content.url);

      const { title, text } = tabData.content;
      const voice = options.voice || GroqService.getAvailableVoices()[0];

      // Step 1: Rewrite text for TTS
      console.log('🔊 Step 1: Rewriting text for TTS...');
      const rewriteResult = await this.rewriteTextForTTS(text, title);
      
      if (!rewriteResult.success || !rewriteResult.rewrittenText) {
        return {
          success: false,
          error: rewriteResult.error || 'Failed to rewrite text for TTS'
        };
      }

      // Step 2: Generate audio from rewritten text
      console.log('🔊 Step 2: Generating audio...');
      const audioResult = await this.generateAudio(rewriteResult.rewrittenText, voice);
      
      if (!audioResult.success) {
        return {
          success: false,
          error: audioResult.error || 'Failed to generate audio'
        };
      }

      // Create TextToSpeech object
      const textToSpeech: TextToSpeech = {
        id: `tts_${Date.now()}`,
        originalText: text,
        rewrittenText: rewriteResult.rewrittenText,
        audioUrl: audioResult.audioUrl || null, // This will be temporary
        voice: voice,
        model: 'meta-llama/llama-3.1-8b-instant',
        generatedAt: Date.now(),
        wordCount: rewriteResult.rewrittenText.split(/\s+/).length,
        estimatedDuration: Math.ceil(rewriteResult.rewrittenText.split(/\s+/).length / 150 * 60) // Rough estimate: 150 words per minute
      };

      console.log('✅ Full TTS pipeline completed successfully');
      return {
        success: true,
        textToSpeech,
        audioBlob: audioResult.audioBlob,
        audioUrl: audioResult.audioUrl
      };

    } catch (error) {
      console.error('❌ TTS pipeline error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown TTS pipeline error'
      };
    }
  }

  /**
   * Get available voices for the UI
   */
  static getAvailableVoices(): string[] {
    return GroqService.getAvailableVoices();
  }

  /**
   * Clean up audio URLs to prevent memory leaks
   */
  static cleanupAudioUrl(url: string) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
} 