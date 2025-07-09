export interface RecipeIngredient {
  name: string;
  amount?: string;
  unit?: string;
  notes?: string;
}

export interface RecipeInstruction {
  step: number;
  text: string;
  time?: string;
  temperature?: string;
}

export interface RecipeNutrition {
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  calories?: string;
  [key: string]: string | undefined; // Allow additional nutrition fields
}

export interface Recipe {
  title: string;
  description?: string;
  author?: string;
  source?: string;
  url: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  nutrition?: RecipeNutrition;
  tags?: string[];
  notes?: string;
  extractedAt: string;
  extractionMethod: string;
}

export interface RecipeExtractionResult {
  recipe?: Recipe;
  rawContent: string;
  error?: string;
  confidence: number;
}

export interface RecipeResponse {
  success: boolean;
  recipe?: Recipe;
  error?: string;
  recipeId?: string;
}

export interface RecipeValidationResult {
  isValid: boolean;
  message?: string;
} 