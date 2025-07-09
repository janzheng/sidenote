import { ThreadgirlService, type ThreadGirlSavePromptRequest } from '../services/threadgirlService';
import type { ThreadgirlPrompt } from '../../types/threadgirlPrompt';

interface ThreadgirlState {
  isProcessing: boolean;
  error: string | null;
  selectedModel: string;
  customPrompt: string;
  prompts: ThreadgirlPrompt[];
  isLoadingPrompts: boolean;
  promptsError: string | null;
  isSavingPrompt: boolean;
  promptSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  promptSaveError: string | null;
}

class ThreadgirlManager {
  private state = $state<ThreadgirlState>({
    isProcessing: false,
    error: null,
    selectedModel: ThreadgirlService.getDefaultModel(),
    customPrompt: '',
    prompts: [],
    isLoadingPrompts: false,
    promptsError: null,
    isSavingPrompt: false,
    promptSaveStatus: 'idle',
    promptSaveError: null
  });

  // Getters for reactive state
  get isProcessing() {
    return this.state.isProcessing;
  }

  get error() {
    return this.state.error;
  }

  get selectedModel() {
    return this.state.selectedModel;
  }

  get customPrompt() {
    return this.state.customPrompt;
  }

  get prompts() {
    return this.state.prompts;
  }

  get isLoadingPrompts() {
    return this.state.isLoadingPrompts;
  }

  get promptsError() {
    return this.state.promptsError;
  }

  get isSavingPrompt() {
    return this.state.isSavingPrompt;
  }

  get promptSaveStatus() {
    return this.state.promptSaveStatus;
  }

  get promptSaveError() {
    return this.state.promptSaveError;
  }

  // Setters for state
  setSelectedModel(model: string) {
    this.state.selectedModel = model;
  }

  setCustomPrompt(prompt: string) {
    this.state.customPrompt = prompt;
  }

  // Load prompts from external service (only available in external mode)
  async loadPrompts(useCache: boolean = true) {
    if (!ThreadgirlService.isExternalModeEnabled()) {
      console.warn('🤖 Prompt loading only available in external mode');
      return;
    }

    this.state.isLoadingPrompts = true;
    this.state.promptsError = null;

    try {
      console.log('🤖 Loading ThreadGirl prompts...');
      const prompts = await ThreadgirlService.loadPrompts(useCache);
      this.state.prompts = prompts;
      this.state.promptsError = null;
      console.log(`🤖 Loaded ${prompts.length} prompts successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load prompts';
      this.state.promptsError = errorMessage;
      console.error('❌ Error loading prompts:', errorMessage);
    } finally {
      this.state.isLoadingPrompts = false;
    }
  }

  // Save a new prompt to external service (only available in external mode)
  async savePrompt(hash: string, name: string, prompt: string) {
    if (!ThreadgirlService.isExternalModeEnabled()) {
      this.state.promptSaveError = 'Prompt saving only available in external mode';
      this.state.promptSaveStatus = 'error';
      return { success: false, error: 'Prompt saving only available in external mode' };
    }

    if (!hash.trim() || !name.trim() || !prompt.trim()) {
      this.state.promptSaveError = 'All fields are required';
      this.state.promptSaveStatus = 'error';
      return { success: false, error: 'All fields are required' };
    }

    this.state.isSavingPrompt = true;
    this.state.promptSaveStatus = 'saving';
    this.state.promptSaveError = null;

    try {
      console.log('🤖 Saving ThreadGirl prompt...');
      
      const request: ThreadGirlSavePromptRequest = {
        hash: hash.trim(),
        name: name.trim(),
        prompt: prompt.trim()
      };

      const result = await ThreadgirlService.savePrompt(request);

      if (result.success) {
        this.state.promptSaveStatus = 'saved';
        this.state.promptSaveError = null;
        console.log('✅ Prompt saved successfully');
        
        // Reload prompts to get the updated list
        await this.loadPrompts(false);
        
        // Reset status after delay
        setTimeout(() => {
          this.state.promptSaveStatus = 'idle';
        }, 2000);

        return { success: true };
      } else {
        this.state.promptSaveStatus = 'error';
        this.state.promptSaveError = result.error || 'Failed to save prompt';
        
        // Reset status after delay
        setTimeout(() => {
          this.state.promptSaveStatus = 'idle';
          this.state.promptSaveError = null;
        }, 3000);

        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.promptSaveStatus = 'error';
      this.state.promptSaveError = errorMessage;
      console.error('❌ Error saving prompt:', errorMessage);
      
      // Reset status after delay
      setTimeout(() => {
        this.state.promptSaveStatus = 'idle';
        this.state.promptSaveError = null;
      }, 3000);

      return { success: false, error: errorMessage };
    } finally {
      this.state.isSavingPrompt = false;
    }
  }

  // Process content with unified ThreadGirl service
  async handleProcessContent(url: string | null, prompt: string, onSuccess?: () => void) {
    if (!url || this.state.isProcessing) {
      return;
    }

    this.state.isProcessing = true;
    this.state.error = null;

    try {
      console.log('🤖 Starting ThreadGirl processing for:', url);
      
      if (ThreadgirlService.isExternalModeEnabled()) {
        // Use external service - get tab data first, then process it
        const response = await chrome.runtime.sendMessage({
          action: 'loadData',
          url: url
        });

        if (!response.success || !response.data) {
          throw new Error('No content data found for this URL. Please extract content first.');
        }

        // Process with unified service (external mode)
        const processResult = await ThreadgirlService.processContent(
          response.data,
          prompt,
          this.state.selectedModel,
          true // use cache
        );

        if (processResult.success && processResult.result) {
          // Save the result back to the tab data via background script
          const saveResponse = await chrome.runtime.sendMessage({
            action: 'processWithThreadgirl',
            url: url,
            prompt: prompt,
            model: this.state.selectedModel,
            // Pass the result directly to avoid double processing
            externalResult: processResult.result
          });

          if (saveResponse.success) {
            console.log('✅ External ThreadGirl processing successful');
            this.state.error = null;
            
            // Call the success callback to refresh the panel
            if (onSuccess) {
              setTimeout(() => {
                onSuccess();
              }, 100); // Small delay to ensure background processing is complete
            }
          } else {
            throw new Error(saveResponse.error || 'Failed to save result');
          }
        } else {
          throw new Error(processResult.error || 'Processing failed');
        }
      } else {
        // Use local service via background script
        const response = await chrome.runtime.sendMessage({
          action: 'processWithThreadgirl',
          url: url,
          prompt: prompt,
          model: this.state.selectedModel
        });

        if (response.success) {
          console.log('✅ Local ThreadGirl processing successful');
          this.state.error = null;
          
          // Call the success callback to refresh the panel
          if (onSuccess) {
            setTimeout(() => {
              onSuccess();
            }, 100); // Small delay to ensure background processing is complete
          }
        } else {
          throw new Error(response.error || 'Processing failed');
        }
      }
    } catch (error) {
      console.error('❌ ThreadGirl processing error:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset error after 5 seconds
      setTimeout(() => {
        this.state.error = null;
      }, 5000);
    } finally {
      this.state.isProcessing = false;
    }
  }

  // Get prompt by hash
  getPromptByHash(hash: string): ThreadgirlPrompt | null {
    return this.state.prompts.find(p => p.hash === hash) || null;
  }

  // Check if external features are available
  isExternalModeEnabled(): boolean {
    return ThreadgirlService.isExternalModeEnabled();
  }

  // Reset state
  reset() {
    this.state.isProcessing = false;
    this.state.error = null;
    this.state.customPrompt = '';
    this.state.promptSaveStatus = 'idle';
    this.state.promptSaveError = null;
  }
}

// Export singleton instance
export const threadgirlManager = new ThreadgirlManager(); 