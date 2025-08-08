import type { TabData } from '../../types/tabData';
import type { ThreadgirlResponse } from '../../types/threadgirlResponse';
import type { ThreadgirlValidationResult } from '../../types/threadgirlValidationResult';
import type { ThreadgirlModel } from '../../types/threadgirlModel';
import type { ThreadgirlResult } from '../../types/threadgirlResult';
import type { ThreadgirlPrompt } from '../../types/threadgirlPrompt';
import { getCurrentSettings } from '../ui/settings.svelte';

// Service interfaces
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

// All available Threadgirl models (both Anthropic and Groq via external proxy)
export const THREADGIRL_MODELS: ThreadgirlModel[] = [
  // Anthropic models
  { name: "Claude Opus 4", id: "claude-opus-4-20250514", provider: "anthropic" },
  { name: "Claude Sonnet 4", id: "claude-sonnet-4-20250514", provider: "anthropic" },
  { name: "Claude Sonnet 3.7", id: "claude-3-7-sonnet-20250219", provider: "anthropic" },
  { name: "Claude Haiku 3.5", id: "claude-3-5-haiku-20241022", provider: "anthropic" },
  // Groq models
  { name: "Llama 3.1 8B Instant", id: "llama-3.1-8b-instant", provider: "groq" },
  { name: "Llama 3.3 70B Versatile", id: "llama-3.3-70b-versatile", provider: "groq" },
  { name: "Llama 4 Maverick 17B", id: "meta-llama/llama-4-maverick-17b-128e-instruct", provider: "groq" },
  { name: "Llama 4 Scout 17B", id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" },
  { name: "Kimi K2", id: "moonshotai/kimi-k2-instruct", provider: "groq" },
  { name: "OAI OSS 120b", id: "openai/gpt-oss-120b", provider: "groq" },
  { name: "OAI OSS 20b", id: "openai/gpt-oss-20b", provider: "groq" }
];

export class ThreadgirlService {

  /**
   * Validate that required settings are configured for Threadgirl
   */
  static validateSettings(): ThreadgirlValidationResult {
    // External service handles authentication
    return { isValid: true };
  }

  /**
   * Load ThreadGirl prompts from external sheet
   */
  static async loadPrompts(useCache: boolean = true): Promise<ThreadgirlPrompt[]> {
    try {
      console.log('🤖 Loading ThreadGirl prompts...');
      
      const settings = getCurrentSettings();
      
      const pipeline = [{
        name: "sheetlog",
        settings: {
          sheetUrl: settings.threadgirlSheetUrl,
          sheet: settings.threadgirlSheetName,
          method: "GET"
        }
      }];

      const response = await fetch(settings.threadgirlPipelineUrl, {
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
   * Save a new ThreadGirl prompt to external sheet
   */
  static async savePrompt(request: ThreadGirlSavePromptRequest): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🤖 Saving ThreadGirl prompt...');
      
      const settings = getCurrentSettings();
      
      const pipeline = [{
        name: "sheetlog",
        settings: {
          sheetUrl: settings.threadgirlSheetUrl,
          sheet: settings.threadgirlSheetName,
          action: "add",
          payload: {
            hash: request.hash,
            name: request.name,
            prompt: request.prompt
          }
        }
      }];

      const response = await fetch(settings.threadgirlPipelineUrl, {
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
   * Process content with Threadgirl using external service
   */
  static async processContent(
    tabData: TabData, 
    prompt: string, 
    model: string,
    useCache: boolean = true
  ): Promise<ThreadgirlResponse> {
    try {
      console.log(`🤖 Starting ThreadGirl processing for TabData:`, tabData.content.url);
      console.log(`🤖 Model parameter received: "${model}"`);
      console.log(`🤖 Model parameter type: ${typeof model}`);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const { text } = tabData.content;

      // Build the final prompt
      const finalPrompt = this.buildFinalPrompt([text], [prompt]);
      
      // Determine model configuration
      const modelConfig = THREADGIRL_MODELS.find(m => m.id === model);
      const provider = modelConfig?.provider || "anthropic";
      
      console.log(`🤖 Using model ${model} with provider ${provider}`);
      console.log(`🤖 Model config found:`, modelConfig);
      
      // Process with external AI service
      const settings = getCurrentSettings();
      
      const pipeline = [{
        name: "ai",
        settings: {
          prompt: finalPrompt,
          model: model,
          provider: provider,
        }
      }];

      const response = await fetch(settings.threadgirlPipelineUrl, {
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

      console.log('✅ ThreadGirl processing completed successfully');
      
      const threadgirlResult: ThreadgirlResult = {
        id: `threadgirl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt: prompt,
        result: cleanedResult,
        model: model,
        createdAt: Date.now()
      };
      
      console.log(`🤖 Created ThreadgirlResult with model: "${threadgirlResult.model}"`);
      
      return {
        success: true,
        result: threadgirlResult
      };

    } catch (error) {
      console.error('❌ ThreadGirl processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
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
   * Default model constant
   */
  // static readonly DEFAULT_MODEL = 'claude-sonnet-4-20250514';
  static readonly DEFAULT_MODEL = 'llama-3.1-8b-instant';
} 