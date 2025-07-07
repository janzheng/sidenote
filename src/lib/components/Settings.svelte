<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, saveSettings as saveSettingsToStore } from '../stores/settings';
  import { chromeStorage } from '../services/chromeStorage';
  import { tabStateManager } from '../services/tabStorage';
  import { 
    savePageDataToStorage, 
    saveStatus,
    isChatStreaming,
    isSummaryStreaming,
    addToLog,
    unifiedPageTextContent,
    unifiedIsSaving,
    unifiedIsLoadingFromStorage
  } from '../stores/apiStore';

  // Import unified tab storage API
  import { 
    reactiveTabData,
    pageContent as unifiedPageContent,
    analysisData as unifiedAnalysisData,
    interactionsData as unifiedInteractionsData
  } from '../stores/reactiveTabStorage';

  // Settings state bound to the store
  let apiKey = $state("");
  let jinaApiKey = $state("");
  let sheetUrl = $state("");
  let sheetName = $state("");
  let autoRefresh = $state(false);
  let autoSave = $state(true);
  let userBackground = $state("");
  let isSaved = $state(false);
  
  // Storage usage state
  let storageUsage = $state<{ bytesInUse: number; quota?: number } | null>(null);
  let isLoadingStorage = $state(false);
  let clearStatus = $state<'idle' | 'cleared' | 'error'>('idle');



  // Add storage copy functionality
  let isCopyingStorage = $state(false);
  let copyStatus = $state<'idle' | 'copying' | 'success' | 'error'>('idle');

  function saveSettings() {
    // Get current settings and update all fields
    const currentSettings = {
      apiKey,
      jinaApiKey,
      sheetUrl,
      sheetName,
      // selectedModel: "meta-llama/llama-4-scout-17b-16e-instruct", // Keep default
      systemPrompt: "", // Keep empty
      debugMode: true, // Keep default
      autoRefresh,
      autoSave,
      userBackground
    };
    
    // Save to store which handles chrome.storage persistence
    saveSettingsToStore(currentSettings);
    
    isSaved = true;
    setTimeout(() => {
      isSaved = false;
    }, 2000);
  }

  async function clearTabData() {
    clearStatus = 'idle';
    try {
      await tabStateManager.clearAllTabData();
      clearStatus = 'cleared';
      
      // Clear the status after 3 seconds
      setTimeout(() => {
        clearStatus = 'idle';
      }, 3000);
    } catch (error) {
      console.error('Failed to clear tab data:', error);
      clearStatus = 'error';
      
      // Clear the error status after 5 seconds
      setTimeout(() => {
        clearStatus = 'idle';
      }, 5000);
    }
  }

  async function loadStorageUsage() {
    isLoadingStorage = true;
    try {
      const usage = await chromeStorage.getUsage();
      storageUsage = usage;
    } catch (error) {
      console.error('Failed to load storage usage:', error);
      storageUsage = null;
    } finally {
      isLoadingStorage = false;
    }
  }



  async function copyStorageData() {
    isCopyingStorage = true;
    copyStatus = 'copying';
    
    try {
      console.log('📋 Starting storage copy...');
      
      // Get all storage data
      const allData = await chromeStorage.getAll();
      console.log('📋 Retrieved storage data:', Object.keys(allData).length, 'keys');
      
      // Create a comprehensive export object
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          totalKeys: Object.keys(allData).length,
          extensionVersion: chrome.runtime.getManifest().version || 'unknown',
          exportedBy: 'SideNote Settings'
        },
        storageData: allData,
        // Add analysis of the data structure
        dataAnalysis: {
          keysByType: {},
          totalSize: JSON.stringify(allData).length
        }
      };
      
      // Analyze key types
      const keysByType: Record<string, string[]> = {};
      Object.keys(allData).forEach(key => {
        if (key.startsWith('sidenote_content_')) {
          if (!keysByType.tabContent) keysByType.tabContent = [];
          keysByType.tabContent.push(key);
        } else if (key.startsWith('sidenote_settings')) {
          if (!keysByType.settings) keysByType.settings = [];
          keysByType.settings.push(key);
        } else if (key.startsWith('sidenote_bookmark')) {
          if (!keysByType.bookmarks) keysByType.bookmarks = [];
          keysByType.bookmarks.push(key);
        } else {
          if (!keysByType.other) keysByType.other = [];
          keysByType.other.push(key);
        }
      });
      
      exportData.dataAnalysis.keysByType = keysByType;
      
      // Copy to clipboard
      const jsonString = JSON.stringify(exportData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      
      console.log('✅ Storage copy completed');
      copyStatus = 'success';
      
      // Reset status after 3 seconds
      setTimeout(() => {
        copyStatus = 'idle';
      }, 3000);
      
    } catch (error) {
      console.error('❌ Storage copy failed:', error);
      copyStatus = 'error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        copyStatus = 'idle';
      }, 5000);
    } finally {
      isCopyingStorage = false;
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onMount(() => {
    // Load storage usage
    loadStorageUsage();
  });

  // Use derived state for settings instead of manual subscription
  $effect(() => {
    const currentSettings = $settings;
    apiKey = currentSettings.apiKey;
    jinaApiKey = currentSettings.jinaApiKey;
    sheetUrl = currentSettings.sheetUrl;
    sheetName = currentSettings.sheetName;
    autoRefresh = currentSettings.autoRefresh;
    autoSave = currentSettings.autoSave;
    userBackground = currentSettings.userBackground;
  });

  // Track previous unified tab data to detect actual changes
  let previousTabData = $state<any>(null);
  let saveTimeout = $state<number | null>(null);

  // Auto-save functionality - MIGRATED to use unified tab storage
  $effect(() => {
    // Only proceed if autosave is enabled and we have content
    if (!autoSave || !$unifiedPageTextContent || !$reactiveTabData) {
      return;
    }

    // Skip auto-save if we're currently loading from storage to prevent feedback loops
    if ($unifiedIsLoadingFromStorage) {
      return;
    }

    const currentData = $reactiveTabData;
    
    // Skip if this is the first run or if the data hasn't actually changed
    if (!previousTabData) {
      previousTabData = currentData;
      return;
    }

    // Check if chat or summary is currently streaming - avoid auto-save during streaming
    if ($isChatStreaming || $isSummaryStreaming) {
      // Still update previous state to avoid triggering when streaming ends
      previousTabData = { ...currentData };
      return;
    }

    // Skip if we're currently saving to prevent cascading saves
    if ($unifiedIsSaving) {
      return;
    }

    // Compare specific fields that matter for saving using unified tab data structure
    // PERFORMANCE: Fixed to avoid triggering during streaming and research processing
    const hasChanged = 
      currentData.content.url !== previousTabData.content.url ||
      currentData.content.title !== previousTabData.content.title ||
      currentData.content.wordCount !== previousTabData.content.wordCount ||
      currentData.content.markdown !== previousTabData.content.markdown ||
      currentData.analysis.summary !== previousTabData.analysis.summary ||
      (currentData.interactions.chatMessages?.length !== previousTabData.interactions.chatMessages?.length && !$isChatStreaming) ||
      // Check for research paper analysis changes (only save when actually new, not during processing)
      (currentData.analysis.researchPaper !== previousTabData.analysis.researchPaper && 
       currentData.analysis.researchPaper !== null && 
       !currentData.processing.progress.researchPaper) ||
      // Check for citation changes
      JSON.stringify(currentData.analysis.citations) !== JSON.stringify(previousTabData.analysis.citations) ||
      // Check for ThreadGirl results changes
      (currentData.interactions.threadGirlResults?.length !== previousTabData.interactions.threadGirlResults?.length);
    
    if (hasChanged && !$unifiedIsSaving) {
      // Clear any existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      // Add a debounced save with shorter timeout for better responsiveness
      saveTimeout = setTimeout(() => {
        savePageDataToStorage();
        saveTimeout = null;
      }, 1500); // Reduced from 2000ms to 1500ms for better UX
    }
    
    // Update the previous state only when we actually save or process
    previousTabData = { ...currentData };
  });
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between mt-4 mb-8">
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
      <p class="text-gray-600 dark:text-gray-400 mt-1">
        Configure your API keys, preferences, and storage settings
      </p>
    </div>
  </div>

    <!-- Logo Section - Above white box -->
  <div class="flex flex-col items-center mb-6">
    <div class="flex flex-col items-center gap-2 mb-2">
      <img src="/icons/sidenote512.png" alt="SideNote Logo" class="w-16 h-16" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300">SideNote</h3>
    </div>
    <p class="text-sm text-gray-600 dark:text-gray-400 text-center">AI-powered webpage analysis and research assistant</p>
  </div>

  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6 flex-1 flex flex-col overflow-y-auto">
    <div class="space-y-6">
      <!-- Top Save Button -->
      <div class="flex justify-end">
        <button 
          class="relative px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 justify-center border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-600 dark:text-white dark:border-blue-700 dark:hover:bg-blue-700"
          onclick={saveSettings}
        >
          {#if isSaved}
            <span class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <span class="text-white">Saved!</span>
            </span>
          {:else}
            Save Settings
          {/if}
        </button>
      </div>
       
       <!-- API Key -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">API Configuration</h3>
                 <div class="space-y-4">
           <div>
             <label for="api-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Groq API Key</label>
             <input 
               type="password" 
               id="api-key"
               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
               placeholder="Enter your Groq API key"
               bind:value={apiKey}
             />
             <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Your Groq API key will be stored securely</p>
             
             {#if !apiKey || apiKey.trim().length === 0}
               <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                 <p class="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">Need a Groq API key?</p>
                 <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                   Get your free API key from Groq to enable AI-powered webpage analysis and chat features.
                 </p>
                 <a 
                   href="https://console.groq.com" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                 >
                   Get API Key from Groq ↗
                 </a>
               </div>
             {:else}
               <div class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                 <div class="flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                     <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                   </svg>
                   <div class="flex-1">
                     <p class="text-sm font-medium text-blue-700 dark:text-blue-300">Groq API Key Configured</p>
                     <p class="text-sm text-blue-600 dark:text-blue-400">All AI features are available</p>
                   </div>
                 </div>
               </div>
             {/if}
           </div>
           
           <div>
             <label for="jina-api-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jina API Key (Optional)</label>
             <input 
               type="password" 
               id="jina-api-key"
               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
               placeholder="Enter your Jina API key"
               bind:value={jinaApiKey}
             />
             <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
               Optional: Enables enhanced content extraction for some websites
             </p>
             
             {#if !jinaApiKey || jinaApiKey.trim().length === 0}
               <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                 <p class="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">Optional Enhancement</p>
                 <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                   Jina API provides enhanced content extraction for difficult websites. SideNote works great without it too.
                 </p>
                 <a 
                   href="https://jina.ai" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                 >
                   Learn about Jina API ↗
                 </a>
               </div>
             {:else}
               <div class="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                 <div class="flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                     <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                   </svg>
                   <div class="flex-1">
                     <p class="text-sm font-medium text-green-700 dark:text-green-300">Jina API Configured</p>
                     <p class="text-sm text-green-600 dark:text-green-400">Enhanced content extraction enabled</p>
                   </div>
                 </div>
               </div>
             {/if}
           </div>
         </div>
      </div>
      
      <!-- Google Sheets Integration -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Google Sheets Integration</h3>
        <div class="space-y-4">
          <div>
            <label for="sheet-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Sheets URL</label>
            <input 
              type="url" 
              id="sheet-url"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              bind:value={sheetUrl}
            />
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Optional: URL of your Google Sheet for bookmark export
            </p>
          </div>
          
          <div>
            <label for="sheet-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sheet Name</label>
            <input 
              type="text" 
              id="sheet-name"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Sheet1"
              bind:value={sheetName}
            />
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Name of the sheet tab where bookmarks will be added
            </p>
          </div>
        </div>
      </div>
      
      <!-- Auto Refresh Setting -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Content Loading</h3>
        <div class="space-y-4">
                     <div class="flex items-center justify-between">
             <div class="flex-1">
               <label for="auto-refresh" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-refresh Content</label>
               <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Automatically extract page content when switching tabs or refreshing</p>
             </div>
             <div class="ml-4">
               <input 
                 type="checkbox" 
                 id="auto-refresh"
                 class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                 bind:checked={autoRefresh}
               />
             </div>
           </div>
        </div>
      </div>
      
      <!-- Auto Save Setting -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Data Persistence</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <label for="auto-save" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-save Page Data</label>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Automatically save page analysis and chat history</p>
            </div>
            <div class="ml-4">
              <input 
                type="checkbox" 
                id="auto-save"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                bind:checked={autoSave}
              />
            </div>
          </div>
          
          {#if autoSave}
            <div class="ml-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-blue-700 dark:text-blue-300">Auto-save Active</p>
                  <p class="text-sm text-blue-600 dark:text-blue-400">
                    Your work is automatically saved every 1.5 seconds
                    {#if $saveStatus === 'saving'}
                      <span class="ml-1">• Saving...</span>
                    {:else if $saveStatus === 'saved'}
                      <span class="ml-1">• Saved ✓</span>
                    {:else if $saveStatus === 'error'}
                      <span class="ml-1">• Error saving</span>
                    {/if}
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- User Background -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Personalization</h3>
        <div class="space-y-4">
          <div>
            <label for="user-background" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Background/Expertise</label>
            <textarea 
              id="user-background"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              placeholder="e.g., I'm a researcher in computer science, interested in AI and machine learning..."
              bind:value={userBackground}
            ></textarea>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Optional: Help AI provide more relevant analysis and summaries
            </p>
          </div>
        </div>
      </div>
      
      <!-- Storage Management -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Storage Management</h3>
        <div class="space-y-4">
          <!-- Storage Usage Display -->
          <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Storage Usage</span>
              <button 
                class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                onclick={loadStorageUsage}
                disabled={isLoadingStorage}
              >
                {isLoadingStorage ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            
            {#if storageUsage}
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Storage Used:</span>
                  <span class="text-gray-900 dark:text-gray-100 font-medium">{formatBytes(storageUsage.bytesInUse)}</span>
                </div>
                
                <!-- Show unlimited storage info since we have unlimitedStorage permission -->
                <div class="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span>Unlimited Storage Available</span>
                </div>
              </div>
            {:else}
              <p class="text-sm text-gray-500 dark:text-gray-400">Loading storage info...</p>
            {/if}
          </div>
          
          <!-- Storage Actions -->
          <div class="space-y-3">
            <button 
              class="w-full px-3 py-2 bg-blue-600 text-white border border-blue-700 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
              onclick={copyStorageData}
              disabled={isCopyingStorage}
            >
              {#if isCopyingStorage}
                📋 Copying Storage...
              {:else}
                📋 Copy Storage Data
              {/if}
            </button>
            
            <button 
              class="w-full px-3 py-2 bg-red-600 text-white border border-red-700 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              onclick={clearTabData}
            >
              Clear All Tab Data
            </button>
            


            {#if copyStatus === 'success'}
              <div class="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p class="text-sm text-green-700 dark:text-green-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Storage data copied to clipboard successfully!
                </p>
              </div>
            {:else if copyStatus === 'error'}
              <div class="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p class="text-sm text-red-700 dark:text-red-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Error copying storage data. Please try again.
                </p>
              </div>
            {/if}



            {#if clearStatus === 'cleared'}
              <div class="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p class="text-sm text-blue-700 dark:text-blue-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Tab data cleared successfully!
                </p>
              </div>
            {:else if clearStatus === 'error'}
              <div class="mt-2 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                <p class="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Error clearing tab data. Please try again.
                </p>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
             <!-- Save Button -->
       <div class="flex justify-end mt-6">
         <button 
           class="relative px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 justify-center border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-600 dark:text-white dark:border-blue-700 dark:hover:bg-blue-700"
           onclick={saveSettings}
         >
           {#if isSaved}
             <span class="flex items-center">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1 text-white" viewBox="0 0 20 20" fill="currentColor">
                 <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
               </svg>
               <span class="text-white">Saved!</span>
             </span>
           {:else}
             Save Settings
           {/if}
         </button>
       </div>
      
    </div>
  </div>
</div> 