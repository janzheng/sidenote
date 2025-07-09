import type { TabData } from '../../types/tabData';
import type { SummaryResponse } from '../../types/summaryResponse';
import type { SummaryValidationResult } from '../../types/summaryValidationResult';
import { GroqService } from './groqService';
import { getCurrentSettings } from '../ui/settings.svelte';

export class SummaryService {

  /**
   * Validate that required settings are configured for AI summary
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
   * Generate a summary for TabData using the direct groqService
   */
  static async generateSummary(tabData: TabData): Promise<SummaryResponse> {
    try {
      console.log('🤖 Starting summary generation for TabData:', tabData.content.url);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const { title, wordCount, text } = tabData.content;
      
      // Create system prompt for summarization
      const systemPrompt = `You are an expert content summarizer. Create concise, informative summaries that capture the key points and insights from the provided content.

Your summary should:
1. Start with a brief overview of the main topic
2. Include the most important key points or findings
3. Highlight any significant conclusions or takeaways
4. Be well-structured and readable
5. Be approximately 150-300 words

Write in clear, professional prose. Focus on accuracy and usefulness.`;

      // Create user prompt with the content
      const userPrompt = `Please summarize this content:

**Title:** ${title}
**Word Count:** ${wordCount}

**Content:**
${text.substring(0, 10000)}${text.length > 10000 ? '...\n\n[Content truncated for length]' : ''}

Provide a comprehensive but concise summary.`;

      // Generate summary using the direct groqService
      const response = await GroqService.generateTextFromPrompt(
        userPrompt,
        systemPrompt,
        {
          model: 'llama-3.1-8b-instant',
          temperature: 0.3,
          maxTokens: 800,
          topP: 0.9
        }
      );

      if (response.success && response.content) {
        console.log('✅ Summary generated successfully');
        return {
          success: true,
          summary: response.content,
          summaryId: `summary_${Date.now()}`
        };
      } else {
        console.error('❌ Summary generation failed:', response.error);
        return {
          success: false,
          error: response.error || 'Failed to generate summary'
        };
      }

    } catch (error) {
      console.error('❌ Summary generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown summary generation error'
      };
    }
  }

  /**
   * Stream summary generation (for future streaming implementation)
   */
  static async streamSummary(tabData: TabData, onChunk: (chunk: string) => void): Promise<SummaryResponse> {
    // TODO: Implement streaming summary generation
    console.log('🤖 Streaming summary not yet implemented, falling back to regular generation');
    return this.generateSummary(tabData);
  }
} 