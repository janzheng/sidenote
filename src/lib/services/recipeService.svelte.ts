import type { TabData } from '../../types/tabData';
import type { RecipeResponse } from '../../types/recipe';
import type { RecipeValidationResult, Recipe } from '../../types/recipe';
import { GroqService } from './groqService.svelte';
import { getCurrentSettings } from '../ui/settings.svelte';

export class RecipeService {

  /**
   * Validate that required settings are configured for AI recipe extraction
   */
  static validateSettings(): RecipeValidationResult {
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
   * Generate a recipe extraction for TabData using the direct groqService
   */
  static async extractRecipe(tabData: TabData): Promise<RecipeResponse> {
    try {
      console.log('🍳 Starting recipe extraction for TabData:', tabData.content.url);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const { title, text } = tabData.content;
      
      // Create system prompt for recipe extraction
      const systemPrompt = `You are an expert recipe extractor. Extract recipe information from web content and return it as a clean, structured JSON object.

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, no additional text.

Extract these fields:
- title: Recipe name
- description: Brief description (optional)
- author: Recipe author/chef (optional)
- ingredients: Array of {name, amount, unit, notes}
- instructions: Array of {step, text, time, temperature}
- nutrition: {servings, prepTime, cookTime, totalTime, calories, etc}
- tags: Array of relevant tags
- notes: Any additional notes

If no recipe is found, return: {"error": "No recipe found in content"}

Example output:
{
  "title": "Chocolate Chip Cookies",
  "ingredients": [
    {"name": "flour", "amount": "2", "unit": "cups"},
    {"name": "butter", "amount": "1", "unit": "cup", "notes": "softened"}
  ],
  "instructions": [
    {"step": 1, "text": "Preheat oven to 375°F", "temperature": "375°F"},
    {"step": 2, "text": "Mix flour and butter", "time": "2 minutes"}
  ],
  "nutrition": {"servings": "24 cookies", "prepTime": "15 minutes", "cookTime": "10 minutes"}
}`;

      // Create user prompt with the content
      const userPrompt = `Extract the recipe from this content:

**Title:** ${title}

**Content:**
${text.substring(0, 15000)}${text.length > 15000 ? '...\n\n[Content truncated for length]' : ''}

Return only valid JSON with the recipe data.`;

      // Generate recipe using the direct groqService
      const response = await GroqService.generateTextFromPrompt(
        userPrompt,
        systemPrompt,
        {
          model: 'llama-3.1-8b-instant',
          temperature: 0.1,
          maxTokens: 3000,
          topP: 0.9
        }
      );

      if (response.success && response.content) {
        try {
          const content = response.content.trim();
          console.log('📄 Raw recipe content:', content);
          
          // Try to parse JSON
          const parsedData = JSON.parse(content);
          
          if (parsedData.error) {
            console.log('❌ No recipe found in content');
            return {
              success: false,
              error: parsedData.error
            };
          } else {
            // Validate and enhance the recipe data
            const recipe = this.validateAndEnhanceRecipe(parsedData, tabData.content.url);
            
            console.log('✅ Recipe extracted successfully:', recipe.title);
            return {
              success: true,
              recipe: recipe,
              recipeId: `recipe_${Date.now()}`
            };
          }
        } catch (parseError) {
          console.error('❌ Failed to parse recipe JSON:', parseError);
          return {
            success: false,
            error: 'Failed to parse recipe data from AI response'
          };
        }
      } else {
        console.error('❌ Recipe extraction failed:', response.error);
        return {
          success: false,
          error: response.error || 'Failed to extract recipe'
        };
      }

    } catch (error) {
      console.error('❌ Recipe extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown recipe extraction error'
      };
    }
  }

  /**
   * Validate and enhance recipe data
   */
  private static validateAndEnhanceRecipe(data: any, url: string): Recipe {
    const recipe: Recipe = {
      title: data.title || 'Untitled Recipe',
      description: data.description || undefined,
      author: data.author || undefined,
      source: data.source || undefined,
      url: url,
      
      ingredients: Array.isArray(data.ingredients) ? data.ingredients.map((ing: any, index: number) => ({
        name: ing.name || `Ingredient ${index + 1}`,
        amount: ing.amount || undefined,
        unit: ing.unit || undefined,
        notes: ing.notes || undefined
      })) : [],
      
      instructions: Array.isArray(data.instructions) ? data.instructions.map((inst: any, index: number) => ({
        step: inst.step || index + 1,
        text: inst.text || inst.instruction || `Step ${index + 1}`,
        time: inst.time || undefined,
        temperature: inst.temperature || undefined
      })) : [],
      
      nutrition: data.nutrition ? {
        servings: data.nutrition.servings || undefined,
        prepTime: data.nutrition.prepTime || data.nutrition.prep_time || undefined,
        cookTime: data.nutrition.cookTime || data.nutrition.cook_time || undefined,
        totalTime: data.nutrition.totalTime || data.nutrition.total_time || undefined,
        calories: data.nutrition.calories || undefined,
        ...Object.fromEntries(
          Object.entries(data.nutrition).filter(([key, value]) => 
            !['servings', 'prepTime', 'cookTime', 'totalTime', 'calories', 'prep_time', 'cook_time', 'total_time'].includes(key) &&
            value !== undefined && value !== null && value !== ''
          )
        )
      } : undefined,
      
      tags: Array.isArray(data.tags) ? data.tags.filter((tag: any) => typeof tag === 'string') : undefined,
      notes: data.notes || undefined,
      
      extractedAt: new Date().toISOString(),
      extractionMethod: 'ai_llama3_1_instant'
    };

    return recipe;
  }
} 