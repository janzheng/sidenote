<script lang="ts">
  import { settingsManager } from '../ui/settings.svelte';
</script>

<div class="h-full flex flex-col pt-16 bg-gray-50">
  <!-- Logo Section -->
  <div class="flex flex-col items-center mb-6">
    <div class="flex flex-col items-center gap-2 mb-2">
      <img src="/icons/sidenote512.png" alt="SideNote Logo" class="w-16 h-16" />
      <h3 class="text-lg font-medium text-gray-700">SideNote</h3>
    </div>
    <p class="text-gray-600 text-center">AI-powered webpage analysis and research assistant</p>
  </div>

  <div class="bg-white rounded-lg border border-gray-200 p-6 flex-1 flex flex-col overflow-y-auto mx-4">
    <div class="space-y-6">
      <!-- Top Save Button -->
      <div class="flex justify-end">
        <button 
          class="px-4 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onclick={() => settingsManager.saveSettings()}
        >
          {#if settingsManager.isSaved}
            <span class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <span class="text-blue-600">Saved!</span>
            </span>
          {:else}
            <span class="text-blue-600">Save Settings</span>
          {/if}
        </button>
      </div>
       
      <!-- API Configuration -->
      <div class="bg-gray-50 p-4 rounded border border-gray-200">
        <h3 class="text-md font-medium mb-3 text-gray-700">API Configuration</h3>
        <div class="space-y-4">
          <div>
            <label for="api-key" class="block font-medium text-gray-700 mb-1">Groq API Key</label>
            <input 
              type="password" 
              id="api-key"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              placeholder="Enter your Groq API key"
              bind:value={settingsManager.settings.apiKey}
              oninput={() => settingsManager.updateSetting('apiKey', settingsManager.settings.apiKey)}
            />
            <p class="mt-1 text-gray-500 text-sm">Your Groq API key will be stored securely</p>
             
            {#if !settingsManager.hasApiKey}
              <div class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p class="text-gray-700 font-medium mb-1">Need a Groq API key?</p>
                <p class="text-gray-600 mb-2 text-sm">
                  Get your free API key from Groq to enable AI-powered webpage analysis and chat features.
                </p>
                <a 
                  href="https://console.groq.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  Get API Key from Groq ↗
                </a>
              </div>
            {/if}
          </div>
           
          <div>
            <label for="jina-api-key" class="block font-medium text-gray-700 mb-1">Jina API Key (Optional)</label>
            <input 
              type="password" 
              id="jina-api-key"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              placeholder="Enter your Jina API key"
              bind:value={settingsManager.settings.jinaApiKey}
              oninput={() => settingsManager.updateSetting('jinaApiKey', settingsManager.settings.jinaApiKey)}
            />
            <p class="mt-1 text-gray-500 text-sm">
              Optional: Enables enhanced content extraction for some websites
            </p>
             
            {#if !settingsManager.hasJinaApiKey}
              <div class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p class="text-gray-700 font-medium mb-1">Optional Enhancement</p>
                <p class="text-gray-600 mb-2 text-sm">
                  Jina API provides enhanced content extraction for difficult websites. SideNote works great without it too.
                </p>
                <a 
                  href="https://jina.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  Learn about Jina API ↗
                </a>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Google Sheets Integration -->
      <div class="bg-gray-50 p-4 rounded border border-gray-200">
        <h3 class="text-md font-medium mb-3 text-gray-700">Google Sheets Integration</h3>
        <div class="space-y-4">
          <div>
            <label for="sheet-url" class="block font-medium text-gray-700 mb-1">Google Sheets URL</label>
            <input 
              type="url" 
              id="sheet-url"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              bind:value={settingsManager.settings.sheetUrl}
              oninput={() => settingsManager.updateSetting('sheetUrl', settingsManager.settings.sheetUrl)}
            />
            <p class="mt-1 text-gray-500 text-sm">
              Optional: URL of your Google Sheet for bookmark export
            </p>
          </div>
          
          <div>
            <label for="sheet-name" class="block font-medium text-gray-700 mb-1">Sheet Name</label>
            <input 
              type="text" 
              id="sheet-name"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              placeholder="Sheet1"
              bind:value={settingsManager.settings.sheetName}
              oninput={() => settingsManager.updateSetting('sheetName', settingsManager.settings.sheetName)}
            />
            <p class="mt-1 text-gray-500 text-sm">
              Name of the sheet tab where bookmarks will be added
            </p>
          </div>
        </div>
      </div>
      
      <!-- Personalization -->
      <div class="bg-gray-50 p-4 rounded border border-gray-200">
        <h3 class="text-md font-medium mb-3 text-gray-700">Personalization</h3>
        <div class="space-y-4">
          <div>
            <label for="user-background" class="block font-medium text-gray-700 mb-1">Your Background/Expertise</label>
            <textarea 
              id="user-background"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
              placeholder="e.g., I'm a researcher in computer science, interested in AI and machine learning..."
              bind:value={settingsManager.settings.userBackground}
              oninput={() => settingsManager.updateSetting('userBackground', settingsManager.settings.userBackground)}
            ></textarea>
            <p class="mt-1 text-gray-500 text-sm">
              Optional: Help AI provide more relevant analysis and summaries
            </p>
          </div>
        </div>
      </div>
      
      <!-- Storage Management -->
      <div class="bg-gray-50 p-4 rounded border border-gray-200">
        <h3 class="text-md font-medium mb-3 text-gray-700">Storage Management</h3>
        <div class="space-y-4">
          <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-gray-700 text-sm">
              <strong>Copy All Data:</strong> Exports your tab data and settings in JSON format. For large datasets (>100 tabs), exports a summary with metadata instead of full content to avoid size limits.
            </p>
          </div>
          <div class="space-y-3">
            <button 
              class="w-full px-3 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50 font-medium"
              onclick={() => settingsManager.copyStorageData()}
              disabled={settingsManager.isCopyingStorage}
            >
              {#if settingsManager.isCopyingStorage}
                <span class="text-blue-600">📋 Copying All Data...</span>
              {:else}
                <span class="text-blue-600">📋 Copy All Data (All Tabs)</span>
              {/if}
            </button>
            
            <button 
              class="w-full px-3 py-2 bg-transparent border-2 border-gray-300 text-gray-600 rounded-md hover:border-red-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition font-medium"
              onclick={() => settingsManager.clearTabData()}
            >
              Clear All Tab Data
            </button>

            {#if settingsManager.copyStatus === 'success'}
              <div class="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p class="text-green-700 flex items-center text-sm">
                  All data copied to clipboard successfully! This includes all tab data and settings.
                </p>
              </div>
            {:else if settingsManager.copyStatus === 'error'}
              <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-red-700 flex items-center text-sm">
                  Error copying all data. Please try again.
                </p>
              </div>
            {/if}

            {#if settingsManager.clearStatus === 'cleared'}
              <div class="mt-4 p-2 bg-green-50 border border-green-200 rounded-md">
                <p class="text-green-700 flex items-center text-sm">
                  Tab data cleared successfully!
                </p>
              </div>
            {:else if settingsManager.clearStatus === 'error'}
              <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p class="text-red-700 flex items-center text-sm">
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
          class="px-4 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onclick={() => settingsManager.saveSettings()}
        >
          {#if settingsManager.isSaved}
            <span class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <span class="text-blue-600">Saved!</span>
            </span>
          {:else}
            <span class="text-blue-600">Save Settings</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
</div> 