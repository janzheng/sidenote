import type { Recipe } from '../../types/recipe';

interface RecipeState {
  isExtracting: boolean;
  recipeStatus: 'idle' | 'extracting' | 'success' | 'error';
  recipeError: string | null;
}

class RecipeManager {
  private state = $state<RecipeState>({
    isExtracting: false,
    recipeStatus: 'idle',
    recipeError: null
  });

  // Getters for reactive state
  get isExtracting() {
    return this.state.isExtracting;
  }

  get recipeStatus() {
    return this.state.recipeStatus;
  }

  get recipeError() {
    return this.state.recipeError;
  }

  // Extract recipe functionality with optional refresh callback
  async handleExtractRecipe(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isExtracting) {
      return;
    }

    this.state.isExtracting = true;
    this.state.recipeStatus = 'extracting';
    this.state.recipeError = null;

    try {
      console.log('🍳 Starting recipe extraction for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'extractRecipe',
        url: url
      });

      if (response.success) {
        console.log('✅ Recipe extraction successful');
        this.state.recipeStatus = 'success';
        this.state.recipeError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.recipeStatus = 'idle';
        }, 3000);
      } else {
        console.error('❌ Recipe extraction failed:', response.error);
        this.state.recipeStatus = 'error';
        this.state.recipeError = response.error;
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.recipeStatus = 'idle';
          this.state.recipeError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Recipe extraction error:', error);
      this.state.recipeStatus = 'error';
      this.state.recipeError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.recipeStatus = 'idle';
        this.state.recipeError = null;
      }, 5000);
    } finally {
      this.state.isExtracting = false;
    }
  }

  // Get CSS classes for recipe button based on status
  getRecipeButtonClass() {
    if (this.state.recipeStatus === 'success') {
      return 'px-6 py-1 rounded text-md text-white bg-green-600 border border-green-600 hover:bg-green-700 flex items-center gap-1';
    } else if (this.state.recipeStatus === 'error') {
      return 'px-6 py-1 rounded text-md text-white bg-red-600 border border-red-600 hover:bg-red-700 flex items-center gap-1';
    } else if (this.state.recipeStatus === 'extracting') {
      return 'px-6 py-1 rounded text-md text-white bg-orange-600 border border-orange-600 hover:bg-orange-700 flex items-center gap-1';
    }
    return 'px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1';
  }

  // Reset recipe state
  reset() {
    this.state.isExtracting = false;
    this.state.recipeStatus = 'idle';
    this.state.recipeError = null;
  }
}

// Export singleton instance
export const recipeManager = new RecipeManager(); 