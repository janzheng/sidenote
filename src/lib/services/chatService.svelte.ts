import type { TabData } from '../../types/tabData';
import type { ChatMessage } from '../../types/chatMessage';
import type { SummaryValidationResult } from '../../types/summaryValidationResult';
import { GroqService } from './groqService.svelte';
import { getCurrentSettings } from '../ui/settings.svelte';

export interface ChatResponse {
  success: boolean;
  message?: string;
  messages?: ChatMessage[];
  error?: string;
}

export class ChatService {

  /**
   * Validate that required settings are configured for AI chat
   */
  static validateSettings(): SummaryValidationResult {
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
   * Send a chat message and get AI response
   */
  static async sendMessage(tabData: TabData, userMessage: string, chatHistory: ChatMessage[] = []): Promise<ChatResponse> {
    try {
      console.log('💬 Starting chat message processing for TabData:', tabData.content.url);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const { title, wordCount, text } = tabData.content;
      
      // Create system prompt for chat
      const systemPrompt = `You are an AI assistant helping users understand and discuss content from web pages. You have access to the following content:

**Title:** ${title}
**Word Count:** ${wordCount}

**Content:**
${text.substring(0, 10000)}${text.length > 10000 ? '...\n\n[Content truncated for length]' : ''}

Your role is to:
1. Answer questions about the content accurately
2. Provide insights and analysis when asked
3. Help users understand complex topics
4. Reference specific parts of the content when relevant
5. Be conversational and helpful

Always base your responses on the provided content when possible. If asked about something not in the content, clearly state that and provide general knowledge if appropriate. Also try to mirror the tone and style of the user's message; if the user is casual, be casual, if the user is formal, be formal!`;

      // Prepare conversation history
      const conversationHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: userMessage }
      ];

      // Generate response using GroqService
      const response = await GroqService.generateText(
        conversationHistory,
        {
          // model: 'llama-3.1-8b-instant',
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          temperature: 0.3,
          maxTokens: 3000,
          topP: 0.9
        }
      );

      if (response.success && response.content) {
        console.log('✅ Chat response generated successfully');
        
        // Create updated chat history
        const updatedMessages: ChatMessage[] = [
          ...chatHistory,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: response.content }
        ];

        return {
          success: true,
          message: response.content,
          messages: updatedMessages
        };
      } else {
        console.error('❌ Chat response generation failed:', response.error);
        return {
          success: false,
          error: response.error || 'Failed to generate chat response'
        };
      }

    } catch (error) {
      console.error('❌ Chat message error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown chat error'
      };
    }
  }

  /**
   * Clear chat history for a tab
   */
  static async clearChatHistory(tabData: TabData): Promise<ChatResponse> {
    try {
      console.log('🗑️ Clearing chat history for TabData:', tabData.content.url);
      
      return {
        success: true,
        messages: []
      };
    } catch (error) {
      console.error('❌ Clear chat history error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear chat history'
      };
    }
  }
} 