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
  static async rewriteTextForTTS(text: string, title?: string, customSystemPrompt?: string): Promise<TtsRewriteResponse> {
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

      // Use custom system prompt if provided, otherwise use default
      const systemPrompt = customSystemPrompt || `You are a university lecturer preparing academic content for spoken delivery. Your task is to make MINIMAL changes to preserve the original author's voice and phrasing while making the text suitable for lecture-style presentation.

CRITICAL: PRESERVE THE ORIGINAL PHRASING AND LANGUAGE AS MUCH AS POSSIBLE. Only make changes that are absolutely necessary for speech conversion.

Your minimal editing should ONLY:
1. Remove or simplify citations that are hard to pronounce (e.g., "[1]", "(Smith et al., 2023)") - either remove them entirely or convert to natural speech like "according to Smith and colleagues"
2. Remove URLs, email addresses, and other hard-to-pronounce technical elements
3. Convert common abbreviations to full words ONLY when they would be unclear when spoken (e.g., "etc." to "and so on", "e.g." to "for example")
4. Fix obvious formatting artifacts from web scraping (extra spaces, broken words)
5. Convert bullet points or numbered lists to flowing text by adding minimal connecting words like "First," "Second," "Additionally," etc.
6. **HANDLE LONG NUMBER SEQUENCES**: When you encounter long lists of numbers, token IDs, coordinates, or similar data sequences, replace them with a brief summary and direct the listener to the original text. For example: "The token IDs are 33, 13969, 4123... and several others - please refer to the original document for the complete sequence."

DO NOT:
- Change the author's word choices, tone, or writing style
- Rewrite sentences for "better flow" unless they are genuinely broken
- Simplify technical language or jargon - keep the original terminology
- Add explanations or interpretations
- Break up long sentences unless they are genuinely problematic for speech
- Add transitions beyond simple list connectors
- Read out every number in long sequences (this makes audio tedious)

LECTURER APPROACH:
- Speak as if presenting to students in a lecture hall
- Maintain the academic tone and precision of the original
- When encountering complex data or long number sequences, guide students to reference the source material
- Use phrases like "as shown in the original text" or "refer to the document for complete details" when appropriate

IMPORTANT: Return ONLY the minimally edited content. Do not include any preamble, introduction, or explanation. Preserve the original text as much as possible - your job is cleanup for spoken delivery, not rewriting.

The goal is to create speech-ready text that sounds like the original author giving a university lecture, with appropriate handling of complex data sequences.`;

      // Create user prompt with the content
      // llama-4-maverick has a large context but we need room for the system prompt and response.
      // Limit to ~60k chars to stay well within limits.
      const maxContentChars = 60000;
      const userPrompt = `${title ? `Title: ${title}\n\n` : ''}Content to rewrite for text-to-speech:

${text.substring(0, maxContentChars)}${text.length > maxContentChars ? '...\n\n[Content truncated for length]' : ''}`;

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
   * Split text into chunks that fit within Groq's token limit
   * Groq TTS API has a 2000 token limit, so we use ~1800 characters to be safe
   * (real-world estimate: 1 token ≈ 1.3 characters, so 1800 chars ≈ 1400 tokens)
   */
  static splitTextIntoChunks(text: string, maxChars: number = 1800): string[] {
    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    
    // First try to split by paragraphs (double newlines)
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const paragraphWithSpacing = currentChunk ? '\n\n' + paragraph : paragraph;
      
      // If adding this paragraph would exceed the limit
      if (currentChunk.length + paragraphWithSpacing.length > maxChars) {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        // If the paragraph itself is too long, split by sentences
        if (paragraph.length > maxChars) {
          const sentenceChunks = this.splitParagraphBySentences(paragraph, maxChars);
          chunks.push(...sentenceChunks);
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      } else {
        currentChunk += paragraphWithSpacing;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Helper method to split a long paragraph by sentences
   */
  private static splitParagraphBySentences(paragraph: string, maxChars: number): string[] {
    const chunks: string[] = [];
    const sentences = paragraph.split(/[.!?]+\s+/);
    let currentChunk = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const isLastSentence = i === sentences.length - 1;
      const sentenceWithPunctuation = isLastSentence ? sentence : sentence + '. ';
      
      // If adding this sentence would exceed the limit
      if (currentChunk.length + sentenceWithPunctuation.length > maxChars) {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        // If the sentence itself is too long, split by words (last resort)
        if (sentenceWithPunctuation.length > maxChars) {
          const wordChunks = this.splitSentenceByWords(sentenceWithPunctuation, maxChars);
          chunks.push(...wordChunks);
          currentChunk = '';
        } else {
          currentChunk = sentenceWithPunctuation;
        }
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
   * Helper method to split a very long sentence by words (last resort)
   */
  private static splitSentenceByWords(sentence: string, maxChars: number): string[] {
    const chunks: string[] = [];
    const words = sentence.split(/\s+/);
    let currentChunk = '';

    for (const word of words) {
      const wordWithSpace = currentChunk ? ' ' + word : word;
      
      if (currentChunk.length + wordWithSpace.length > maxChars) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = word;
      } else {
        currentChunk += wordWithSpace;
      }
    }

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

    // WAV files have a 44-byte header. When merging multiple WAV chunks,
    // keep only the first chunk's header and strip headers from subsequent chunks,
    // then update the first header's data size fields to reflect the total size.
    const WAV_HEADER_SIZE = 44;
    const chunks: ArrayBuffer[] = [];

    for (const blob of audioBlobs) {
      const arrayBuffer = await blob.arrayBuffer();
      chunks.push(arrayBuffer);
    }

    // Calculate total data size (all audio data without headers from chunks 2+)
    let totalDataSize = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        totalDataSize += chunks[i].byteLength - WAV_HEADER_SIZE;
      } else {
        // Strip the 44-byte WAV header from subsequent chunks
        totalDataSize += chunks[i].byteLength - WAV_HEADER_SIZE;
      }
    }

    const totalLength = WAV_HEADER_SIZE + totalDataSize;
    const combined = new Uint8Array(totalLength);

    // Copy the first chunk in full (including its header)
    combined.set(new Uint8Array(chunks[0]), 0);

    // Copy data (sans header) from subsequent chunks
    let offset = chunks[0].byteLength;
    for (let i = 1; i < chunks.length; i++) {
      const chunkData = new Uint8Array(chunks[i], WAV_HEADER_SIZE);
      combined.set(chunkData, offset);
      offset += chunkData.byteLength;
    }

    // Update the WAV header in the combined buffer:
    // Bytes 4-7: ChunkSize = total file size - 8
    const view = new DataView(combined.buffer);
    view.setUint32(4, totalLength - 8, true);  // little-endian
    // Bytes 40-43: Subchunk2Size = total audio data size
    view.setUint32(40, totalDataSize, true);  // little-endian

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