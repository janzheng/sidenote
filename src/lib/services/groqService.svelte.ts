import type { ChatMessage } from '../../types/chatMessage';
import type { GenerateTextOptions } from '../../types/generateTextOptions';
import type { GenerateTextResponse } from '../../types/generateTextResponse';
import { getCurrentSettings } from '../ui/settings.svelte';
import { cleanAndParseJson } from '../utils/cleanAndParseJson';
import { extractJsonFromResponse } from '../utils/extractJsonFromResponse';

/**
 * Simple, focused Groq API service that makes direct HTTP calls
 * No Chrome extension messaging, just pure API interaction
 */
export class GroqService {
  private static readonly BASE_URL = 'https://api.groq.com/openai/v1';
  private static readonly DEFAULT_MODEL = 'llama-3.1-8b-instant';
  private static readonly TIMEOUT = 60000; // 60 seconds

  /**
   * Generate text using Groq API
   */
  static async generateText(
    messages: ChatMessage[],
    options: GenerateTextOptions = {}
  ): Promise<GenerateTextResponse> {
    try {
      console.log('🚀 Starting direct Groq API call');
      console.log('📝 Messages to send:', messages.length, 'messages');

      const settings = getCurrentSettings();
      if (!settings.apiKey) {
        return { 
          success: false, 
          error: 'Groq API key not configured. Please set it in settings.' 
        };
      }

      const requestBody = {
        model: options.model || this.DEFAULT_MODEL,
        messages: messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens || 4000,
        top_p: options.topP ?? 0.9,
        stop: options.stop || null,
        stream: false
      };

      console.log('🔧 Request config:', {
        model: requestBody.model,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        messages_count: messages.length
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(`${this.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Groq API error:', response.status, errorText);
        
        let errorMessage = `API request failed with status ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // Use generic error message
        }

        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      console.log('📥 Groq API response received:', {
        choices: data.choices?.length || 0,
        usage: data.usage
      });

      if (!data.choices || data.choices.length === 0) {
        return { success: false, error: 'No response generated' };
      }

      const content = data.choices[0].message?.content || '';
      
      return {
        success: true,
        content: content.trim(),
        usage: data.usage
      };

    } catch (error) {
      console.error('❌ Groq API call failed:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Request timed out' };
        }
        return { success: false, error: error.message };
      }
      
      return { success: false, error: 'Unknown error occurred' };
    }
  }

  /**
   * Generate text with JSON parsing
   */
  static async generateTextWithJsonParsing(
    messages: ChatMessage[],
    options: GenerateTextOptions = {}
  ): Promise<GenerateTextResponse & { parsedJson?: any }> {
    const response = await this.generateText(messages, options);
    
    if (!response.success || !response.content) {
      return response;
    }

    // Try to extract and parse JSON from the response
    try {
      const parsedJson = extractJsonFromResponse(response.content);
      if (parsedJson) {
        console.log('✅ Successfully parsed JSON from response');
        return { ...response, parsedJson };
      } else {
        console.log('ℹ️ No JSON found in response, returning as plain text');
        return response;
      }
    } catch (error) {
      console.warn('⚠️ JSON parsing failed, returning plain text response:', error);
      return response;
    }
  }

  /**
   * Simple helper to generate text with a single prompt
   */
  static async generateTextFromPrompt(
    prompt: string,
    systemPrompt?: string,
    options: GenerateTextOptions = {}
  ): Promise<GenerateTextResponse> {
    const messages: ChatMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    return this.generateText(messages, options);
  }

  /**
   * Generate text from prompt with JSON parsing
   */
  static async generateTextFromPromptWithJsonParsing(
    prompt: string,
    systemPrompt?: string,
    options: GenerateTextOptions = {}
  ): Promise<GenerateTextResponse & { parsedJson?: any }> {
    const messages: ChatMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    return this.generateTextWithJsonParsing(messages, options);
  }
}

// Export the static methods as functions for backward compatibility
export const generateText = GroqService.generateText.bind(GroqService);
export const generateTextFromPrompt = GroqService.generateTextFromPrompt.bind(GroqService);
export const generateTextWithJsonParsing = GroqService.generateTextWithJsonParsing.bind(GroqService);
export const generateTextFromPromptWithJsonParsing = GroqService.generateTextFromPromptWithJsonParsing.bind(GroqService);
