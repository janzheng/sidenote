import type { TabData } from '../../types/tabData';
import type { ThreadgirlResponse } from '../../types/threadgirlResponse';
import type { ThreadgirlValidationResult } from '../../types/threadgirlValidationResult';
import type { ThreadgirlModel } from '../../types/threadgirlModel';
import type { ThreadgirlResult } from '../../types/threadgirlResult';
import type { ThreadgirlPrompt } from '../../types/threadgirlPrompt';
import { GroqService } from './groqService';
import { getCurrentSettings } from '../ui/settings.svelte';

// External API URLs - configurable
const PIPELINE_URL = "https://yawnxyz-executeproxy.web.val.run/execute";
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxcRuTKTnvisvI-MIS_Rd_EJ7z3B3rYD_ohfMp1VUgrz2E6N72HIYye_hvLn8-Pj_M/exec";
const SHEET_NAME = "Capsid Toolbox Prompts";

// Configuration for service mode
type ServiceMode = 'local' | 'external';
const SERVICE_MODE: ServiceMode = 'external'; // Toggle between 'local' and 'external'

// External service interfaces
export interface ThreadGirlSource {
  enabled: boolean;
  url: string;
  text: string;
  useFirecrawl: boolean;
}

export interface ThreadGirlSavePromptRequest {
  hash: string;
  name: string;
  prompt: string;
}

// Updated Threadgirl models with external service models
export const THREADGIRL_MODELS: ThreadgirlModel[] = [
  // External service models (Claude 4 series)
  { name: "Claude Opus 4", id: "claude-opus-4-20250514", provider: "anthropic" },
  { name: "Claude Sonnet 4", id: "claude-sonnet-4-20250514", provider: "anthropic" },
  { name: "Claude Sonnet 3.7", id: "claude-3-7-sonnet-20250219", provider: "anthropic" },
  { name: "Claude Haiku 3.5", id: "claude-3-5-haiku-20241022", provider: "anthropic" },
  // Local Groq models
  { name: "Llama 3.1 8B Instant", id: "llama-3.1-8b-instant", provider: "groq" },
  { name: "Llama 3.3 70B Versatile", id: "llama-3.3-70b-versatile", provider: "groq" },
  { name: "Llama 4 Maverick 17B", id: "meta-llama/llama-4-maverick-17b-128e-instruct", provider: "groq" },
  { name: "Llama 4 Scout 17B", id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" }
];

export class ThreadgirlService {

  /**
   * Validate that required settings are configured for Threadgirl
   */
  static validateSettings(): ThreadgirlValidationResult {
    if (SERVICE_MODE === 'local') {
      const settings = getCurrentSettings();
      
      if (!settings.apiKey || settings.apiKey.trim().length === 0) {
        return { 
          isValid: false, 
          message: 'Groq API key is required. Please configure it in settings.' 
        };
      }
    }
    // External service doesn't need API keys
    
    return { isValid: true };
  }

  /**
   * Load ThreadGirl prompts from external sheet (only available in external mode)
   */
  static async loadPrompts(useCache: boolean = true): Promise<ThreadgirlPrompt[]> {
    if (SERVICE_MODE === 'local') {
      console.warn('🤖 Prompt loading only available in external mode');
      return [];
    }

    try {
      console.log('🤖 Loading ThreadGirl prompts from external service...');
      
      const pipeline = [{
        name: "sheetlog",
        settings: {
          sheetUrl: SHEET_URL,
          sheet: SHEET_NAME,
          method: "GET"
        }
      }];

      const response = await fetch(PIPELINE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useCache,
          saveCache: true,
          cacheTTL: 3600 * 24 * 7, // 1 week
          pipeline 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to fetch prompts`);
      }

      const result = await response.json();
      const prompts = result?.data || [];
      
      console.log(`🤖 Loaded ${prompts.length} ThreadGirl prompts`);
      return prompts;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load prompts';
      console.error(`🤖 Error loading ThreadGirl prompts: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Save a new ThreadGirl prompt to external sheet (only available in external mode)
   */
  static async savePrompt(request: ThreadGirlSavePromptRequest): Promise<{ success: boolean; error?: string }> {
    if (SERVICE_MODE === 'local') {
      console.warn('🤖 Prompt saving only available in external mode');
      return { success: false, error: 'Prompt saving only available in external mode' };
    }

    try {
      console.log('🤖 Saving ThreadGirl prompt to external service...');
      
      const pipeline = [{
        name: "sheetlog",
        settings: {
          sheetUrl: SHEET_URL,
          sheet: SHEET_NAME,
          action: "add",
          payload: {
            hash: request.hash,
            name: request.name,
            prompt: request.prompt
          }
        }
      }];

      const response = await fetch(PIPELINE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pipeline
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Unknown error");
      }

      console.log('🤖 ThreadGirl prompt saved successfully');
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save prompt';
      console.error(`🤖 Save error: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process content with Threadgirl using either local or external service
   */
  static async processContent(
    tabData: TabData, 
    prompt: string, 
    model: string = SERVICE_MODE === 'external' ? 'claude-sonnet-4-20250514' : 'llama-3.1-8b-instant',
    useCache: boolean = true
  ): Promise<ThreadgirlResponse> {
    try {
      console.log(`🤖 Starting ThreadGirl processing (${SERVICE_MODE} mode) for TabData:`, tabData.content.url);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const { title, wordCount, text } = tabData.content;

      if (SERVICE_MODE === 'external') {
        return await this.processWithExternalService(tabData, prompt, model, useCache);
      } else {
        return await this.processWithLocalService(tabData, prompt, model);
      }

    } catch (error) {
      console.error('❌ ThreadGirl processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * Process content using external service
   */
  private static async processWithExternalService(
    tabData: TabData, 
    prompt: string, 
    model: string,
    useCache: boolean
  ): Promise<ThreadgirlResponse> {
    const { text } = tabData.content;

    // Build the final prompt
    const finalPrompt = this.buildFinalPrompt([text], [prompt]);
    
    // Determine model configuration
    const modelConfig = THREADGIRL_MODELS.find(m => m.id === model);
    const provider = modelConfig?.provider || "anthropic";
    
    console.log(`🤖 Using external model ${model} with provider ${provider}`);
    
    // Process with external AI service
    const pipeline = [{
      name: "ai",
      settings: {
        prompt: finalPrompt,
        model: model,
        provider: provider,
      }
    }];

    const response = await fetch(PIPELINE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        useCache, 
        pipeline 
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Unknown error");
    }

    const result = await response.text();
    
    // Remove surrounding quotes if the result is a stringified JSON
    let cleanedResult = result;
    if (result.startsWith('"') && result.endsWith('"')) {
      try {
        cleanedResult = JSON.parse(result);
      } catch {
        cleanedResult = result.slice(1, -1);
      }
    }

    console.log('✅ External ThreadGirl processing completed successfully');
    
    const threadgirlResult: ThreadgirlResult = {
      id: `threadgirl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prompt: prompt,
      result: cleanedResult,
      model: model,
      createdAt: Date.now()
    };
    
    return {
      success: true,
      result: threadgirlResult
    };
  }

  /**
   * Process content using local Groq service
   */
  private static async processWithLocalService(
    tabData: TabData, 
    prompt: string, 
    model: string
  ): Promise<ThreadgirlResponse> {
    const { title, wordCount, text } = tabData.content;
    
    // Create system prompt for Threadgirl processing
    const systemPrompt = `You are Threadgirl, an advanced AI content processor. You excel at analyzing, summarizing, rewriting, and transforming content according to specific instructions.

Your capabilities include:
- Deep content analysis and understanding
- Creative rewriting and restructuring
- Extracting key insights and patterns
- Adapting tone and style as requested
- Providing comprehensive responses

Always provide thoughtful, accurate, and well-structured responses that directly address the user's prompt.`;

    // Create user prompt with the content and instructions
    const userPrompt = `**Content to Process:**

**Title:** ${title}
**Word Count:** ${wordCount}

**Content:**
${text.substring(0, 15000)}${text.length > 15000 ? '...\n\n[Content truncated for length]' : ''}

**Instructions:**
${prompt}

Please process the above content according to the instructions provided.`;

    // Use GroqService for local processing
    const response = await GroqService.generateTextFromPrompt(
      userPrompt,
      systemPrompt,
      {
        model: model,
        temperature: 0.7,
        maxTokens: 2000,
        topP: 0.9
      }
    );

    if (response.success && response.content) {
      console.log('✅ Local ThreadGirl processing completed successfully');
      
      const threadgirlResult: ThreadgirlResult = {
        id: `threadgirl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt: prompt,
        result: response.content,
        model: model,
        createdAt: Date.now()
      };
      
      return {
        success: true,
        result: threadgirlResult
      };
    } else {
      console.error('❌ Local ThreadGirl processing failed:', response.error);
      return {
        success: false,
        error: response.error || 'Failed to process content'
      };
    }
  }

  /**
   * Helper function to build the final prompt for external service
   */
  private static buildFinalPrompt(sourceContents: string[], prompts: string[]): string {
    return `<system prompt>
${prompts.join('\n')}
</system prompt>

<source content>
${sourceContents.join('\n\n')}
</source content>
`;
  }

  /**
   * Get available models for Threadgirl
   */
  static getAvailableModels(): ThreadgirlModel[] {
    return THREADGIRL_MODELS;
  }

  /**
   * Get default model based on service mode
   */
  static getDefaultModel(): string {
    return SERVICE_MODE === 'external' ? 'claude-sonnet-4-20250514' : 'llama-3.1-8b-instant';
  }

  /**
   * Get current service mode
   */
  static getServiceMode(): ServiceMode {
    return SERVICE_MODE;
  }

  /**
   * Check if external features are available
   */
  static isExternalModeEnabled(): boolean {
    return SERVICE_MODE === 'external';
  }
} 