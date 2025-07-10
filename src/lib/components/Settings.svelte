<script lang="ts">
  import { settingsManager } from '../ui/settings.svelte';
</script>

<div class="h-full flex flex-col pt-16">
  <!-- Logo Section -->
  <div class="flex flex-col items-center mb-6">
    <div class="flex flex-col items-center gap-2 mb-2">
      <img src="/icons/sidenote512.png" alt="SideNote Logo" class="w-16 h-16" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300">SideNote</h3>
    </div>
    <p class="text-gray-600 dark:text-gray-400 text-center">AI-powered webpage analysis and research assistant</p>
  </div>

  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6 flex-1 flex flex-col overflow-y-auto">
    <div class="space-y-6">
      <!-- Top Save Button -->
      <div class="flex justify-end">
        <button 
          class="relative px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 justify-center border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onclick={() => settingsManager.saveSettings()}
        >
          {#if settingsManager.isSaved}
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
       
      <!-- API Configuration -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-bold mb-3 text-gray-700 dark:text-gray-300">API Configuration</h3>
        <div class="space-y-4">
          <div>
            <label for="api-key" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">Groq API Key</label>
            <input 
              type="password" 
              id="api-key"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your Groq API key"
              bind:value={settingsManager.settings.apiKey}
              oninput={() => settingsManager.updateSetting('apiKey', settingsManager.settings.apiKey)}
            />
            <p class="mt-1 text-gray-500 dark:text-gray-400">Your Groq API key will be stored securely</p>
             
            {#if !settingsManager.hasApiKey}
              <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <p class="text-gray-700 dark:text-gray-300 font-medium mb-1">Need a Groq API key?</p>
                <p class="text-gray-600 dark:text-gray-400 mb-2">
                  Get your free API key from Groq to enable AI-powered webpage analysis and chat features.
                </p>
                <a 
                  href="https://console.groq.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                >
                  Get API Key from Groq ↗
                </a>
              </div>
            {/if}
          </div>
           
          <div>
            <label for="jina-api-key" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">Jina API Key (Optional)</label>
            <input 
              type="password" 
              id="jina-api-key"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your Jina API key"
              bind:value={settingsManager.settings.jinaApiKey}
              oninput={() => settingsManager.updateSetting('jinaApiKey', settingsManager.settings.jinaApiKey)}
            />
            <p class="mt-1 text-gray-500 dark:text-gray-400">
              Optional: Enables enhanced content extraction for some websites
            </p>
             
            {#if !settingsManager.hasJinaApiKey}
              <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <p class="text-gray-700 dark:text-gray-300 font-medium mb-1">Optional Enhancement</p>
                <p class="text-gray-600 dark:text-gray-400 mb-2">
                  Jina API provides enhanced content extraction for difficult websites. SideNote works great without it too.
                </p>
                <a 
                  href="https://jina.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                >
                  Learn about Jina API ↗
                </a>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Google Sheets Integration -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-bold mb-3 text-gray-700 dark:text-gray-300">Google Sheets Integration</h3>
        <div class="space-y-4">
          <div>
            <label for="sheet-url" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">Google Sheets URL</label>
            <input 
              type="url" 
              id="sheet-url"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              bind:value={settingsManager.settings.sheetUrl}
              oninput={() => settingsManager.updateSetting('sheetUrl', settingsManager.settings.sheetUrl)}
            />
            <p class="mt-1 text-gray-500 dark:text-gray-400">
              Optional: URL of your Google Sheet for bookmark export
            </p>
          </div>
          
          <div>
            <label for="sheet-name" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">Sheet Name</label>
            <input 
              type="text" 
              id="sheet-name"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Sheet1"
              bind:value={settingsManager.settings.sheetName}
              oninput={() => settingsManager.updateSetting('sheetName', settingsManager.settings.sheetName)}
            />
            <p class="mt-1 text-gray-500 dark:text-gray-400">
              Name of the sheet tab where bookmarks will be added
            </p>
          </div>
        </div>
      </div>
      
      <!-- Personalization -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-bold mb-3 text-gray-700 dark:text-gray-300">Personalization</h3>
        <div class="space-y-4">
          <div>
            <label for="user-background" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">Your Background/Expertise</label>
            <textarea 
              id="user-background"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              placeholder="e.g., I'm a researcher in computer science, interested in AI and machine learning..."
              bind:value={settingsManager.settings.userBackground}
              oninput={() => settingsManager.updateSetting('userBackground', settingsManager.settings.userBackground)}
            ></textarea>
            <p class="mt-1 text-gray-500 dark:text-gray-400">
              Optional: Help AI provide more relevant analysis and summaries
            </p>
          </div>
        </div>
      </div>
      
      <!-- Storage Management -->
      <div class="border-b border-gray-200 dark:border-gray-600 pb-6">
        <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Storage Management</h3>
        <div class="space-y-4">
          <div class="space-y-3">
            <button 
              class="w-full px-3 py-2 bg-blue-600 text-white border border-blue-700 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
              onclick={() => settingsManager.copyStorageData()}
              disabled={settingsManager.isCopyingStorage}
            >
              {#if settingsManager.isCopyingStorage}
                📋 Copying Storage...
              {:else}
                📋 Copy Storage Data
              {/if}
            </button>
            
            <button 
              class="w-full px-3 py-2 bg-red-600 text-white border border-red-700 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              onclick={() => settingsManager.clearTabData()}
            >
              Clear All Tab Data
            </button>

            {#if settingsManager.copyStatus === 'success'}
              <div class="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p class="text-green-700 dark:text-green-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Storage data copied to clipboard successfully!
                </p>
              </div>
            {:else if settingsManager.copyStatus === 'error'}
              <div class="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p class="text-red-700 dark:text-red-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Error copying storage data. Please try again.
                </p>
              </div>
            {/if}

            {#if settingsManager.clearStatus === 'cleared'}
              <div class="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p class="text-blue-700 dark:text-blue-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Tab data cleared successfully!
                </p>
              </div>
            {:else if settingsManager.clearStatus === 'error'}
              <div class="mt-2 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                <p class="text-gray-700 dark:text-gray-300 flex items-center">
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
      
      <!-- Bottom Save Button -->
      <div class="flex justify-end mt-6">
        <button 
          class="relative px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 justify-center border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onclick={() => settingsManager.saveSettings()}
        >
          {#if settingsManager.isSaved}
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