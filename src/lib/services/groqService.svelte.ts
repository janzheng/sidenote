import type { ChatMessage, ToolCall } from '../../types/chatMessage';
import type { GenerateTextOptions } from '../../types/generateTextOptions';
import type { GenerateTextResponse } from '../../types/generateTextResponse';
import { getCurrentSettings } from '../ui/settings.svelte';
import { cleanAndParseJson } from '../utils/cleanAndParseJson';
import { extractJsonFromResponse } from '../utils/extractJsonFromResponse';

// Tool use types
export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ToolCallResponse extends GenerateTextResponse {
  toolCalls?: ToolCall[];
  needsToolExecution?: boolean;
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

/**
 * Simple, focused Groq API service that makes direct HTTP calls
 * No Chrome extension messaging, just pure API interaction
 */
export class GroqService {
  private static readonly BASE_URL = 'https://api.groq.com/openai/v1';
  // private static readonly DEFAULT_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct';
  private static readonly DEFAULT_MODEL = 'moonshotai/kimi-k2-instruct';
  private static readonly DEFAULT_TTS_MODEL = 'playai-tts';
  private static readonly DEFAULT_TTS_VOICE = 'Arista-PlayAI';
  private static readonly TIMEOUT = 120000; // 120 seconds (2 minutes)

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
        messages: messages,
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

        // Add specific guidance for common error codes
        if (response.status === 429) {
          errorMessage = `Rate limit exceeded. ${errorMessage}. Please wait a moment and try again.`;
        } else if (response.status === 413 || errorMessage.toLowerCase().includes('too large') || errorMessage.toLowerCase().includes('token')) {
          errorMessage = `Content too large for model context window. ${errorMessage}`;
        }

        return { success: false, error: errorMessage };
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        console.error('❌ Groq API returned no choices');
        return { success: false, error: 'No response generated' };
      }

      console.log('📥 Groq API response received:', {
        message: data.choices[0].message,
        choices: data.choices.length,
        usage: data.usage
      });

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
          return { success: false, error: 'Request timed out after 2 minutes. The content may be too large or the API may be slow.' };
        }
        return { success: false, error: error.message };
      }

      return { success: false, error: 'Unknown error occurred' };
    }
  }

  /**
   * Generate text with tool use support using Groq API
   */
  static async generateTextWithTools(
    messages: ChatMessage[],
    tools: Tool[],
    options: GenerateTextOptions = {}
  ): Promise<ToolCallResponse> {
    try {
      console.log('🛠️ Starting Groq API call with tools');
      console.log('📝 Messages to send:', messages.length, 'messages');
      console.log('🔧 Tools available:', tools.map(t => t.function.name));

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
        tools: tools,
        tool_choice: 'auto',
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
        messages: messages,
        messages_count: messages.length,
        tools_count: tools.length
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

      if (!data.choices || data.choices.length === 0) {
        console.error('❌ Groq API returned no choices');
        return { success: false, error: 'No response generated' };
      }

      console.log('📥 Groq API response received:', {
        message: data.choices[0].message,
        choices: data.choices.length,
        usage: data.usage,
        hasToolCalls: !!data.choices[0]?.message?.tool_calls
      });

      const responseMessage = data.choices[0].message;
      const toolCalls = responseMessage.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        console.log('🛠️ Tool calls detected:', toolCalls.map((tc: any) => tc.function.name));
        return {
          success: true,
          content: responseMessage.content || '',
          toolCalls: toolCalls,
          needsToolExecution: true,
          usage: data.usage
        };
      } else {
        // No tool calls, return regular response
        return {
          success: true,
          content: responseMessage.content?.trim() || '',
          needsToolExecution: false,
          usage: data.usage
        };
      }

    } catch (error) {
      console.error('❌ Groq API call with tools failed:', error);
      
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
   * Execute a complete tool conversation flow
   */
  static async executeToolConversation(
    initialMessages: ChatMessage[],
    tools: Tool[],
    toolExecutor: (toolCall: ToolCall) => Promise<string>,
    options: GenerateTextOptions = {}
  ): Promise<GenerateTextResponse & { conversationMessages?: ChatMessage[] }> {
    try {
      console.log('🔄 Starting tool conversation flow');
      
      const conversationMessages = [...initialMessages];
      
      // First API call with tools
      const initialResponse = await this.generateTextWithTools(conversationMessages, tools, options);
      
      if (!initialResponse.success) {
        return initialResponse;
      }

      if (!initialResponse.needsToolExecution || !initialResponse.toolCalls) {
        // No tools needed, return the response directly
        return {
          success: true,
          content: initialResponse.content,
          conversationMessages,
          usage: initialResponse.usage
        };
      }

      // Add the assistant's response with tool calls to conversation
      conversationMessages.push({
        role: 'assistant',
        content: initialResponse.content || null,
        tool_calls: initialResponse.toolCalls
      });

      // Execute all tool calls
      console.log('🛠️ Executing tool calls:', initialResponse.toolCalls.length);
      
      for (const toolCall of initialResponse.toolCalls) {
        try {
          console.log(`🔧 Executing tool: ${toolCall.function.name}`);
          const toolResult = await toolExecutor(toolCall);
          
          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id
          });
          
          console.log(`✅ Tool ${toolCall.function.name} executed successfully`);
        } catch (toolError) {
          console.error(`❌ Tool ${toolCall.function.name} failed:`, toolError);
          
          // Add error result to conversation
          conversationMessages.push({
            role: 'tool',
            content: `Error executing ${toolCall.function.name}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`,
            tool_call_id: toolCall.id
          });
        }
      }

      // Second API call with tool results
      console.log('🔄 Making follow-up API call with tool results');
      const finalResponse = await this.generateText(conversationMessages, options);
      
      if (!finalResponse.success) {
        return finalResponse;
      }

      return {
        success: true,
        content: finalResponse.content,
        conversationMessages,
        usage: finalResponse.usage
      };

    } catch (error) {
      console.error('❌ Tool conversation flow failed:', error);
      
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      
      return { success: false, error: 'Tool conversation flow failed' };
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

  /**
   * Generate text-to-speech audio using Groq API
   */
  static async generateSpeech(
    text: string,
    voice: string = this.DEFAULT_TTS_VOICE,
    model: string = this.DEFAULT_TTS_MODEL
  ): Promise<{ success: boolean; audioBlob?: Blob; error?: string }> {
    try {
      console.log('🔊 Starting TTS generation with Groq API');
      console.log('🔊 Text length:', text.length, 'characters');
      console.log('🔊 Voice:', voice);
      console.log('🔊 Model:', model);

      const settings = getCurrentSettings();
      if (!settings.apiKey) {
        return { 
          success: false, 
          error: 'Groq API key not configured. Please set it in settings.' 
        };
      }

      // Validate text length (Groq has a 10K character limit)
      if (text.length > 10000) {
        return {
          success: false,
          error: 'Text is too long for TTS generation. Maximum 10,000 characters allowed.'
        };
      }

      const requestBody = {
        model: model,
        input: text,
        voice: voice,
        response_format: 'wav'
      };

      console.log('🔊 TTS Request config:', {
        model: requestBody.model,
        voice: requestBody.voice,
        text_length: text.length
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(`${this.BASE_URL}/audio/speech`, {
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
        console.error('❌ Groq TTS API error:', response.status, errorText);
        
        let errorMessage = `TTS API request failed with status ${response.status}`;
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

      const audioBlob = await response.blob();
      console.log('🔊 TTS audio generated successfully, blob size:', audioBlob.size, 'bytes');

      return {
        success: true,
        audioBlob
      };

    } catch (error) {
      console.error('❌ Groq TTS API call failed:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'TTS request timed out' };
        }
        return { success: false, error: error.message };
      }
      
      return { success: false, error: 'Unknown TTS error occurred' };
    }
  }

  /**
   * Get available TTS voices for English
   */
  static getAvailableVoices(): string[] {
    return [
      'Arista-PlayAI',
      'Atlas-PlayAI', 
      'Basil-PlayAI',
      'Briggs-PlayAI',
      'Calum-PlayAI',
      'Celeste-PlayAI',
      'Cheyenne-PlayAI',
      'Chip-PlayAI',
      'Cillian-PlayAI',
      'Deedee-PlayAI',
      'Fritz-PlayAI',
      'Gail-PlayAI',
      'Indigo-PlayAI',
      'Mamaw-PlayAI',
      'Mason-PlayAI',
      'Mikail-PlayAI',
      'Mitch-PlayAI',
      'Quinn-PlayAI',
      'Thunder-PlayAI'
    ];
  }

  /**
   * Get available TTS voices for Arabic
   */
  static getAvailableArabicVoices(): string[] {
    return [
      'Ahmad-PlayAI',
      'Amira-PlayAI',
      'Khalid-PlayAI',
      'Nasser-PlayAI'
    ];
  }

  /**
   * Search the web using Groq's compound-beta model with agentic tooling
   */
  static async searchWeb(
    query: string,
    options: {
      excludeDomains?: string[];
      includeDomains?: string[];
      country?: string;
      model?: 'compound-beta' | 'compound-beta-mini';
    } = {}
  ): Promise<{ success: boolean; content?: string; executedTools?: any[]; error?: string }> {
    try {
      console.log('🔍 Starting web search with compound-beta model');
      console.log('🔍 Query:', query);
      console.log('🔍 Options:', options);

      const settings = getCurrentSettings();
      if (!settings.apiKey) {
        return { 
          success: false, 
          error: 'Groq API key not configured. Please set it in settings.' 
        };
      }

      const model = options.model || 'compound-beta-mini';
      
      const requestBody: any = {
        model: model,
        messages: [
          {
            role: 'user',
            content: query
          }
        ]
      };

      // Add search settings if provided
      const searchSettings: any = {};
      if (options.excludeDomains && options.excludeDomains.length > 0) {
        searchSettings.exclude_domains = options.excludeDomains;
      }
      if (options.includeDomains && options.includeDomains.length > 0) {
        searchSettings.include_domains = options.includeDomains;
      }
      if (options.country) {
        searchSettings.country = options.country;
      }

      if (Object.keys(searchSettings).length > 0) {
        requestBody.search_settings = searchSettings;
      }

      console.log('🔍 Request config:', {
        model: requestBody.model,
        query: query,
        search_settings: requestBody.search_settings
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
        console.error('❌ Groq web search API error:', response.status, errorText);
        
        let errorMessage = `Web search API request failed with status ${response.status}`;
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

      if (!data.choices || data.choices.length === 0) {
        console.error('❌ Groq web search API returned no choices');
        return { success: false, error: 'No search results generated' };
      }

      console.log('🔍 Web search response received:', {
        content: data.choices[0]?.message?.content,
        executedTools: data.choices[0]?.message?.executed_tools,
        choices: data.choices.length,
        usage: data.usage
      });

      const content = data.choices[0].message?.content || '';
      const executedTools = data.choices[0].message?.executed_tools || [];
      
      return {
        success: true,
        content: content.trim(),
        executedTools
      };

    } catch (error) {
      console.error('❌ Groq web search API call failed:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Web search request timed out' };
        }
        return { success: false, error: error.message };
      }
      
      return { success: false, error: 'Unknown web search error occurred' };
    }
  }
}

// Export the static methods as functions for backward compatibility
export const generateText = GroqService.generateText.bind(GroqService);
export const generateTextFromPrompt = GroqService.generateTextFromPrompt.bind(GroqService);
export const generateTextWithJsonParsing = GroqService.generateTextWithJsonParsing.bind(GroqService);
export const generateTextFromPromptWithJsonParsing = GroqService.generateTextFromPromptWithJsonParsing.bind(GroqService);
export const generateSpeech = GroqService.generateSpeech.bind(GroqService);
export const generateTextWithTools = GroqService.generateTextWithTools.bind(GroqService);
export const executeToolConversation = GroqService.executeToolConversation.bind(GroqService);
export const searchWeb = GroqService.searchWeb.bind(GroqService);
