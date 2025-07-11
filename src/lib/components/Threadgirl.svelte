<script lang="ts">
  import { marked } from 'marked';
  import { onMount } from 'svelte';
  import Icon from "@iconify/svelte";
  import { threadgirlManager } from '../ui/threadgirlManager.svelte';
  import { THREADGIRL_MODELS } from '../services/threadgirlService.svelte';
  import type { ThreadgirlResult } from '../../types/threadgirlResult';
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import { settingsManager } from '../ui/settings.svelte';
  import ThreadgirlSettings from './ui/ThreadgirlSettings.svelte';

  interface Props {
    url: string | null;
    content: any;
    threadgirlResults: ThreadgirlResult[] | null;
    isProcessing: boolean;
    onRefresh?: () => void;
  }

  let { url, content, threadgirlResults, isProcessing, onRefresh }: Props = $props();

  // Component state
  let isExpanded = $state(false);
  let selectedTemplate = $state('');
  let instructionsText = $state('');
  let newPromptHash = $state('');
  let newPromptName = $state('');

  // Reactive variables
  const results = $derived(threadgirlResults || []);
  const hasResults = $derived(results.length > 0);
  const hasContent = $derived(!!(content?.text || url));

  // Copy success states for labeled buttons
  let copyStates = $state(new Map<string, boolean>());

  // Handle template selection - uses prompts from service
  function handleTemplateChange() {
    if (selectedTemplate) {
      const selectedPrompt = threadgirlManager.getPromptByHash(selectedTemplate);
      if (selectedPrompt) {
        instructionsText = selectedPrompt.prompt;
        console.log(`ThreadGirl: Selected prompt "${selectedPrompt.name}"`);
      }
    }
  }

  // Process content with ThreadGirl using external service
  async function threadItOut() {
    if (!instructionsText.trim()) {
      console.log("ThreadGirl: No instructions provided");
      return;
    }

    if (!content?.text) {
      console.log("ThreadGirl: No page content available");
      return;
    }

    console.log("ThreadGirl: Starting processing...");
    
    await threadgirlManager.handleProcessContent(url, instructionsText, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Save new prompt using service
  async function savePrompt() {
    if (!newPromptHash.trim() || !newPromptName.trim() || !instructionsText.trim()) {
      console.log("ThreadGirl: Please fill in hash, name, and instructions");
      return;
    }

    console.log("ThreadGirl: Saving prompt to service...");
    
    const result = await threadgirlManager.savePrompt(
      newPromptHash.trim(),
      newPromptName.trim(),
      instructionsText.trim()
    );
    
    if (result.success) {
      // Clear form on success
      newPromptHash = '';
      newPromptName = '';
      console.log("ThreadGirl: Prompt saved successfully");
    } else {
      console.error("ThreadGirl: Failed to save prompt:", result.error);
    }
  }

  // Refresh prompts from service
  async function refreshPrompts() {
    console.log("ThreadGirl: Refreshing prompts from service...");
    await threadgirlManager.loadPrompts(false); // Force refresh, no cache
  }

  // Auto-adjust textarea height
  function adjustTextareaHeight(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }

  // Time formatter for result timestamps
  const timeFormatter = new Intl.DateTimeFormat([], { 
    hour: '2-digit', 
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  });
  
  function formatTime(timestamp: number): string {
    return timeFormatter.format(new Date(timestamp));
  }

  // Copy success state management
  function handleCopySuccess(key: string, success: boolean) {
    copyStates.set(key, success);
    copyStates = new Map(copyStates); // Trigger reactivity
  }

  // Copy result to clipboard
  async function copyResult(result?: string) {
    const textToCopy = result || (results.length > 0 ? results[results.length - 1].result : '');
    if (!textToCopy) {
      console.log("ThreadGirl: No result to copy");
      return;
    }
    await navigator.clipboard.writeText(textToCopy);
    console.log("ThreadGirl: Result copied to clipboard");
  }

  // Copy result formatted for C&T/Notion
  async function copyForCT(result?: string) {
    const title = content?.title || 'Untitled';
    const pageUrl = url || '';
    const resultText = result || (results.length > 0 ? results[results.length - 1].result : '');
    
    if (!resultText) {
      console.log("ThreadGirl: No result to copy");
      return;
    }
    
    // Clean the result for Notion table compatibility
    const cleanResult = resultText
      .replace(/\n/g, ' ')  // Replace line breaks with spaces
      .replace(/\r/g, ' ')  // Replace carriage returns
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    try {
      // Try HTML table format first (Notion prefers this)
      const htmlTable = `<table><tr><td>${title}</td><td></td><td></td><td></td><td></td><td>${cleanResult}</td><td></td><td></td><td></td><td>${pageUrl}</td></tr></table>`;
      
      // Create both HTML and plain text versions
      const plainText = `${title}\t\t\t\t\t${cleanResult}\t\t\t\t${pageUrl}`;
      
      // Use the modern clipboard API with both formats
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlTable], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' })
      });
      
      await navigator.clipboard.write([clipboardItem]);
      console.log("ThreadGirl: Result copied for C&T (Notion table format)");
    } catch (error) {
      // Fallback to plain text if HTML clipboard fails
      const plainText = `${title}\t\t\t\t\t${cleanResult}\t\t\t\t${pageUrl}`;
      await navigator.clipboard.writeText(plainText);
      console.log("ThreadGirl: Result copied for C&T (plain text fallback)");
    }
  }

  // Clear all results (placeholder)
  function clearAllResults() {
    console.log("ThreadGirl: Clear all results functionality would be implemented here");
    // Would need to implement in threadgirlManager or background
  }

  // Remove single result (placeholder)
  function removeResult(resultId: string) {
    console.log("ThreadGirl: Remove result functionality would be implemented here", resultId);
    // Would need to implement in threadgirlManager or background
  }

  onMount(() => {
    // Load prompts from service on mount
    console.log("ThreadGirl: Component mounted, loading prompts...");
    threadgirlManager.loadPrompts(true); // Use cache on initial load
  });
</script>

<ToggleDrawer 
  title="ThreadGirl" 
  bind:isExpanded
>
  {#snippet children()}
    <!-- Model Selection -->
    <div class="space-y-2">
      <label for="threadgirl-model-select" class="block font-medium text-gray-700 dark:text-gray-300">
        Model
      </label>
      <div class="relative">
        <select 
          id="threadgirl-model-select"
          bind:value={threadgirlManager.selectedModel}
          class="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white appearance-none outline-none"
        >
          {#each THREADGIRL_MODELS as model}
            <option value={model.id}>
              {model.name}
            </option>
          {/each}
        </select>
        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
          <Icon icon="mdi:chevron-down" class="w-6 h-6" />
        </div>
      </div>
    </div>

    <!-- Threadgirl Configuration -->
    <ThreadgirlSettings />

    <!-- Template Selection -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label for="threadgirl-template-select" class="block font-medium text-gray-700 dark:text-gray-300">
          Template Instructions
        </label>
        <button 
          onclick={refreshPrompts}
          class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
          disabled={threadgirlManager.isLoadingPrompts}
        >
          {#if threadgirlManager.isLoadingPrompts}
            <Icon icon="mdi:loading" class="animate-spin w-3 h-3" />
          {:else}
            <Icon icon="mdi:refresh" class="w-3 h-3" />
          {/if}
          Refresh
        </button>
      </div>
      
      <div class="relative">
        <select 
          id="threadgirl-template-select"
          bind:value={selectedTemplate}
          onchange={handleTemplateChange}
          class="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white appearance-none outline-none"
          disabled={threadgirlManager.isLoadingPrompts}
        >
          <option value="">
            {threadgirlManager.isLoadingPrompts ? 'Loading prompts...' : 'Select a template...'}
          </option>
          {#each threadgirlManager.prompts as prompt}
            <option value={prompt.hash}>
              {prompt.name}
            </option>
          {/each}
        </select>
        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
          <Icon icon="mdi:chevron-down" class="w-6 h-6" />
        </div>
      </div>
      
      {#if threadgirlManager.promptsError}
        <div class="text-red-600 dark:text-red-400">
          Error loading prompts: {threadgirlManager.promptsError}
        </div>
      {/if}
    </div>

    <!-- Instructions Text Area -->
    <div class="space-y-2">
      <label for="threadgirl-instructions" class="block font-medium text-gray-700 dark:text-gray-300">
        Instructions
      </label>
      <textarea 
        id="threadgirl-instructions"
        bind:value={instructionsText}
        oninput={adjustTextareaHeight}
        placeholder="Select a template or write your own instructions..."
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none"
        rows="4"
        style="min-height: 100px; overflow-y: auto;"
      ></textarea>
    </div>

    <!-- Save Template Section -->
    <div class="space-y-2 py-2 px-2 bg-gray-50 dark:bg-gray-700 rounded">
      <div class="block font-medium text-gray-700 dark:text-gray-300">
        Save as New Template
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input 
          type="text"
          id="threadgirl-prompt-hash"
          bind:value={newPromptHash}
          placeholder="hash"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none"
          disabled={threadgirlManager.isSavingPrompt}
        />
        <input 
          type="text"
          id="threadgirl-prompt-name"
          bind:value={newPromptName}
          placeholder="name"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none"
          disabled={threadgirlManager.isSavingPrompt}
        />
      </div>
      <button 
        onclick={savePrompt}
        class="w-full px-3 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition flex items-center justify-center gap-2 font-semibold cursor-pointer
               {threadgirlManager.promptSaveStatus === 'saved' ? 'bg-green-100 text-green-800' : ''}
               {threadgirlManager.promptSaveStatus === 'error' ? 'bg-red-100 text-red-800' : ''}"
        disabled={!newPromptHash.trim() || !newPromptName.trim() || !instructionsText.trim() || threadgirlManager.isSavingPrompt}
      >
        {#if threadgirlManager.isSavingPrompt}
          <Icon icon="mdi:loading" class="animate-spin w-6 h-6" />
          Saving...
        {:else if threadgirlManager.promptSaveStatus === 'saved'}
          <Icon icon="mdi:check" class="w-6 h-6" />
          Saved!
        {:else if threadgirlManager.promptSaveStatus === 'error'}
          <Icon icon="mdi:alert" class="w-6 h-6" />
          Error
        {:else}
          <Icon icon="mdi:content-save" class="w-6 h-6" />
          Save as Template
        {/if}
      </button>
      
      {#if threadgirlManager.promptSaveError}
        <div class="text-red-600 dark:text-red-400">
          {threadgirlManager.promptSaveError}
        </div>
      {/if}
    </div>

    <!-- Thread It Out Button -->
    <div class="pt-2 mt-8">
      <button 
        onclick={threadItOut}
        class="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition flex items-center justify-center gap-2 font-semibold cursor-pointer"
        disabled={threadgirlManager.isProcessing || isProcessing || !instructionsText.trim() || !content?.text}
      >
        {#if threadgirlManager.isProcessing || isProcessing}
          <Icon icon="mdi:loading" class="animate-spin w-5 h-5" />
          💅 I'm threading, I'm threading...
        {:else}
          💅 Thread it out, girl
        {/if}
      </button>
      
      {#if !content?.text}
        <p class="mt-2 text-gray-500 dark:text-gray-400 text-center">
          No page content available to process
        </p>
      {/if}
    </div>

    <!-- Results -->
    {#if hasResults}
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <div class="flex items-center justify-between">
          <div class="block font-medium text-gray-700 dark:text-gray-300">
            Results ({results.length})
          </div>
          <div class="flex gap-2">
            <CopyButton 
              copyFn={() => copyResult()}
              buttonClass="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              iconClass="w-3 h-3"
              title="Copy latest result"
            />
            <button 
              onclick={() => {
                if (!threadgirlManager.isProcessing && !isProcessing) clearAllResults();
              }}
              class="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors flex items-center gap-1 cursor-pointer {threadgirlManager.isProcessing || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}"
              disabled={threadgirlManager.isProcessing || isProcessing}
              title="Clear all results"
            >
              <Icon icon="mdi:trash-can" class="w-3 h-3" />
              Clear All
            </button>
          </div>
        </div>
        
        <div class="space-y-3 overflow-y-auto">
          {#each results as result (result.id)}
            <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded border group">
              <div class="flex items-center justify-between mb-2">
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {formatTime(result.createdAt)} • {result.model || 'Unknown model'}
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton 
                    copyFn={() => copyResult(result.result)}
                    buttonClass="flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors cursor-pointer {copyStates.get(`copy-${result.id}`) ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'}"
                    iconClass="w-3 h-3"
                    title="Copy result"
                    onSuccess={(success) => handleCopySuccess(`copy-${result.id}`, success)}
                  >
                    <span>Copy</span>
                  </CopyButton>
                  
                  <CopyButton 
                    copyFn={() => copyForCT(result.result)}
                    buttonClass="flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors cursor-pointer {copyStates.get(`ct-${result.id}`) ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700'}"
                    iconClass="w-3 h-3"
                    title="Copy for C&T"
                    onSuccess={(success) => handleCopySuccess(`ct-${result.id}`, success)}
                  >
                    <span>C&T</span>
                  </CopyButton>
                  
                  <button 
                    onclick={() => removeResult(result.id)}
                    class="px-2 py-1 text-sm bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                    title="Delete this result"
                  >
                    <Icon icon="mdi:trash-can" class="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div class="mb-2 p-2 bg-gray-100 dark:bg-gray-600 rounded text-sm">
                <strong>Prompt:</strong> {result.prompt}
              </div>
              
              <div class="overflow-y-auto">
                <pre class="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{result.result}</pre>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Error Display -->
    {#if threadgirlManager.error}
      <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-center gap-2">
          <Icon icon="mdi:alert" class="w-5 h-5 text-red-600 dark:text-red-400" />
          <div class="flex-1">
            <p class="font-medium text-red-800 dark:text-red-200">Error</p>
            <p class="text-red-700 dark:text-red-300">{threadgirlManager.error}</p>
          </div>
        </div>
      </div>
    {/if}
  {/snippet}
</ToggleDrawer>
