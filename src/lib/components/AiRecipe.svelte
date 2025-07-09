<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import { recipeManager } from '../ui/recipeManager.svelte';
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import { RecipeService } from '../services/recipeService';
  import type { Recipe, RecipeIngredient, RecipeInstruction } from '../../types/recipe';

  interface Props {
    url: string | null;
    content: any;
    recipe: Recipe | null;
    isExtracting: boolean;
    onRefresh?: () => void;
  }

  let { url, content, recipe, isExtracting, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);
  let isCopied = $state(false);
  let showJson = $state(false);

  // Derived states
  const hasRecipe = $derived(recipe && recipe.title && recipe.title.length > 0);
  const canExtract = $derived(url && content && content.text && content.text.length > 0);
  const isRecipePage = $derived(url && content ? RecipeService.isRecipePage({ content: { url, text: content.text || '', title: content.title || '', html: '', markdown: '', metadata: {}, wordCount: 0, extractedAt: 0 } } as any) : false);

  // Handle recipe extraction
  async function handleExtractRecipe() {
    if (!url || recipeManager.isExtracting) {
      return;
    }

    await recipeManager.handleExtractRecipe(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle copying recipe
  async function handleCopyRecipe() {
    if (!recipe) return;
    
    try {
      const content = showJson ? formatRecipeJson() : formatRecipeText();
      await navigator.clipboard.writeText(content);
      isCopied = true;
      setTimeout(() => {
        isCopied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy recipe:', error);
    }
  }

  // Format recipe for display
  function formatRecipeText(): string {
    if (!recipe) return '';
    
    let text = `# ${recipe.title}\n\n`;
    
    if (recipe.description) {
      text += `${recipe.description}\n\n`;
    }
    
    if (recipe.author) {
      text += `**Author:** ${recipe.author}\n`;
    }
    
    if (recipe.nutrition) {
      text += `## Recipe Info\n`;
      if (recipe.nutrition.servings) text += `- **Servings:** ${recipe.nutrition.servings}\n`;
      if (recipe.nutrition.prepTime) text += `- **Prep Time:** ${recipe.nutrition.prepTime}\n`;
      if (recipe.nutrition.cookTime) text += `- **Cook Time:** ${recipe.nutrition.cookTime}\n`;
      if (recipe.nutrition.totalTime) text += `- **Total Time:** ${recipe.nutrition.totalTime}\n`;
      if (recipe.nutrition.calories) text += `- **Calories:** ${recipe.nutrition.calories}\n`;
      text += '\n';
    }
    
    if (recipe.ingredients.length > 0) {
      text += `## Ingredients\n`;
      recipe.ingredients.forEach((ingredient: RecipeIngredient) => {
        let line = `- ${ingredient.name}`;
        if (ingredient.amount) line += ` (${ingredient.amount}`;
        if (ingredient.unit) line += ` ${ingredient.unit}`;
        if (ingredient.amount) line += ')';
        if (ingredient.notes) line += ` - ${ingredient.notes}`;
        text += `${line}\n`;
      });
      text += '\n';
    }
    
    if (recipe.instructions.length > 0) {
      text += `## Instructions\n`;
      recipe.instructions.forEach((instruction: RecipeInstruction) => {
        let line = `${instruction.step}. ${instruction.text}`;
        if (instruction.temperature || instruction.time) {
          const details = [];
          if (instruction.temperature) details.push(instruction.temperature);
          if (instruction.time) details.push(instruction.time);
          line += ` (${details.join(', ')})`;
        }
        text += `${line}\n`;
      });
      text += '\n';
    }
    
    if (recipe.tags && recipe.tags.length > 0) {
      text += `**Tags:** ${recipe.tags.join(', ')}\n\n`;
    }
    
    if (recipe.notes) {
      text += `## Notes\n${recipe.notes}\n\n`;
    }
    
    text += `*Extracted on ${new Date(recipe.extractedAt).toLocaleDateString()} using ${recipe.extractionMethod}*`;
    
    return text;
  }

  // Format recipe as JSON
  function formatRecipeJson(): string {
    return JSON.stringify(recipe, null, 2);
  }

  // Get confidence color
  function getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  // Get confidence icon
  function getConfidenceIcon(confidence: number): string {
    if (confidence >= 80) return 'mdi:check-circle';
    if (confidence >= 60) return 'mdi:alert-circle';
    return 'mdi:close-circle';
  }

  // Calculate confidence for display
  const recipeConfidence = $derived(() => {
    if (!recipe) return 0;
    return RecipeService.calculateRecipeConfidence(recipe);
  });
</script>

<ToggleDrawer
  title="Recipe Extractor"
  bind:isExpanded
>
  {#snippet children()}
    <!-- About Section -->
    <div class="py-2">
      Extract structured recipe data from cooking websites using AI. Automatically identifies ingredients, instructions, cooking times, and nutritional information.
    </div>

    <!-- Recipe Detection -->
    {#if isRecipePage}
      <div class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm">
        <div class="flex items-center gap-2">
          <Icon icon="mdi:chef-hat" class="w-5 h-5 text-orange-600" />
          <span class="font-semibold text-orange-800">Recipe page detected!</span>
        </div>
        <div class="mt-1 text-orange-700">
          This page appears to contain recipe content that can be extracted.
        </div>
      </div>
    {/if}

    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={handleExtractRecipe}
        class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canExtract || isExtracting || recipeManager.isExtracting}
        title={recipeManager.recipeError || 'Extract Recipe from Page'}
      >
        {#if isExtracting || recipeManager.isExtracting}
          <Icon icon="mdi:loading" class="animate-spin w-8 h-8" />
          Extracting...
        {:else}
          <Icon icon="mdi:chef-hat" class="w-8 h-8 text-orange-600" />
          <span class="font-semibold px-2 py-1 text-orange-600">Extract Recipe</span>
        {/if}
      </button>
      
      {#if hasRecipe && !isExtracting && !recipeManager.isExtracting}
        <button 
          onclick={handleCopyRecipe}
          class="px-3 py-2 text-gray-600 hover:text-orange-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
          title="Copy recipe"
        >
          {#if isCopied}
            <Icon icon="mdi:check" class="w-6 h-6 text-green-600" />
          {:else}
            <Icon icon="mdi:content-copy" class="w-6 h-6" />
          {/if}
        </button>
        
        <button 
          onclick={() => showJson = !showJson}
          class="px-3 py-2 text-gray-600 hover:text-orange-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
          title={showJson ? 'Show formatted text' : 'Show JSON'}
        >
          <Icon icon={showJson ? 'mdi:format-text' : 'mdi:code-json'} class="w-6 h-6" />
        </button>
      {/if}
    </div>

    <!-- Content Display -->
    {#if recipeManager.recipeError}
      <div class="bg-red-50 border border-red-200 p-3 rounded">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">Recipe Extraction Error</div>
            <div class="text-sm opacity-75">{recipeManager.recipeError}</div>
          </div>
        </div>
      </div>
    {:else if hasRecipe}
      <!-- Recipe Summary -->
      <div class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm">
        <div class="flex items-center gap-2 mb-2">
          <Icon icon="mdi:chef-hat" class="w-6 h-6 text-orange-600" />
          <span class="font-semibold text-orange-800">Recipe Extracted</span>
          <div class="flex items-center gap-1 ml-auto">
            <Icon icon={getConfidenceIcon(recipeConfidence())} class={`w-4 h-4 ${getConfidenceColor(recipeConfidence())}`} />
            <span class={`text-xs font-medium ${getConfidenceColor(recipeConfidence())}`}>
              {recipeConfidence()}% confidence
            </span>
          </div>
        </div>
        
                 <div class="grid grid-cols-2 gap-2 text-xs">
           <div class="flex items-center gap-1">
             <Icon icon="mdi:format-title" class="w-4 h-4 text-gray-600" />
             <span class="font-medium">{recipe?.title || 'Unknown Recipe'}</span>
           </div>
           
           <div class="flex items-center gap-1">
             <Icon icon="mdi:food" class="w-4 h-4 text-green-600" />
             <span>{recipe?.ingredients?.length || 0} ingredients</span>
           </div>
           
           <div class="flex items-center gap-1">
             <Icon icon="mdi:format-list-numbered" class="w-4 h-4 text-blue-600" />
             <span>{recipe?.instructions?.length || 0} steps</span>
           </div>
           
           {#if recipe?.nutrition?.totalTime}
             <div class="flex items-center gap-1">
               <Icon icon="mdi:clock" class="w-4 h-4 text-purple-600" />
               <span>{recipe.nutrition.totalTime}</span>
             </div>
           {/if}
           
           {#if recipe?.nutrition?.servings}
             <div class="flex items-center gap-1">
               <Icon icon="mdi:account-group" class="w-4 h-4 text-gray-600" />
               <span>{recipe.nutrition.servings}</span>
             </div>
           {/if}
           
           {#if recipe?.author}
             <div class="flex items-center gap-1">
               <Icon icon="mdi:account" class="w-4 h-4 text-gray-600" />
               <span>{recipe.author}</span>
             </div>
           {/if}
         </div>
      </div>

      <div class="bg-gray-50 p-3 rounded border min-h-[120px] max-h-[400px] overflow-y-auto">
        <div class="text-gray-700 prose prose-sm max-w-none">
          {#if showJson}
            <pre class="text-xs bg-gray-100 p-2 rounded overflow-x-auto">{formatRecipeJson()}</pre>
          {:else}
            <div class="whitespace-pre-wrap text-sm">{formatRecipeText()}</div>
          {/if}
          {#if isExtracting || recipeManager.isExtracting}
            <span class="inline-block w-2 h-4 bg-orange-600 animate-pulse ml-1"></span>
          {/if}
        </div>
      </div>
    {:else if !canExtract}
      <div class="text-gray-500 italic text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:chef-hat" class="w-8 h-8 opacity-50" />
        <div>No page content available to extract recipes</div>
        {#if !url}
          <div class="text-xs">Waiting for page URL...</div>
        {:else if !content?.text}
          <div class="text-xs">No extracted content found</div>
        {/if}
      </div>
    {:else if isExtracting || recipeManager.isExtracting}
      <div class="bg-gray-50 p-3 rounded border min-h-[120px] flex items-center justify-center">
        <div class="text-gray-500 italic text-center flex flex-col items-center gap-2">
          <Icon icon="mdi:chef-hat" class="w-8 h-8 animate-pulse text-orange-600" />
          <div>Extracting recipe data...</div>
          <div class="text-xs opacity-75">AI is analyzing the page content</div>
        </div>
      </div>
    {/if}
  {/snippet}
</ToggleDrawer> 