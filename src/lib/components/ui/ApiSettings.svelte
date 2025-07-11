<script lang="ts">
  import { settingsManager } from '../../ui/settings.svelte';
  import Icon from "@iconify/svelte";

  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  // Track if user has interacted with settings
  let hasInteracted = $state(false);

  // Show settings if API key is missing, or if background is missing (when not compact)
  // But only hide automatically if user hasn't interacted yet
  const shouldShowSettings = $derived(
    hasInteracted || 
    !settingsManager.hasApiKey || 
    (!compact && !settingsManager.settings.userBackground?.trim())
  );

  // Handle saving settings
  async function handleSaveSettings() {
    await settingsManager.saveSettings();
  }

  // Mark as interacted when user starts typing
  function handleInteraction() {
    hasInteracted = true;
  }
</script>

{#if shouldShowSettings}
<!-- API Configuration -->
<div class="space-y-3 py-3 px-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
  <div class="font-medium text-gray-700 dark:text-gray-300">
    API Configuration
  </div>
  
  <div class="space-y-2">
    <label for="groq-api-key" class="block text-sm font-medium text-gray-600 dark:text-gray-400">
      Groq API Key
    </label>
    <input 
      type="password" 
      id="groq-api-key"
      class="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none"
      placeholder="Enter your Groq API key"
      bind:value={settingsManager.settings.apiKey}
      oninput={() => {
        handleInteraction();
        settingsManager.updateSetting('apiKey', settingsManager.settings.apiKey);
      }}
      onfocus={handleInteraction}
    />
    {#if !settingsManager.hasApiKey}
      <div class="mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
        <p class="text-gray-700 dark:text-gray-300 font-medium mb-1">Need a Groq API key?</p>
        <p class="text-gray-600 dark:text-gray-400 mb-1">
          Get your free API key from Groq to enable AI features.
        </p>
        <a 
          href="https://console.groq.com" 
          target="_blank" 
          rel="noopener noreferrer"
          class="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          Get API Key from Groq ↗
        </a>
      </div>
    {/if}
  </div>
  
  {#if !compact}
    <div class="space-y-2">
      <label for="user-background" class="block text-sm font-medium text-gray-600 dark:text-gray-400">
        Your Background (Optional)
      </label>
      <textarea
        id="user-background"
        bind:value={settingsManager.settings.userBackground}
        placeholder="e.g., computer science, biology, economics..."
        rows="2"
        class="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none resize-none"
        oninput={() => {
          handleInteraction();
          settingsManager.updateSetting('userBackground', settingsManager.settings.userBackground);
        }}
        onfocus={handleInteraction}
      ></textarea>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Help AI tailor responses to your expertise
      </p>
    </div>
  {/if}
  
  <!-- Save Button -->
  <div class="flex justify-end mt-3">
    <button 
      onclick={handleSaveSettings}
      class="px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      disabled={settingsManager.isSaving}
    >
      {#if settingsManager.isSaving}
        <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
        Saving...
      {:else if settingsManager.isSaved}
        <Icon icon="mdi:check" class="w-4 h-4 text-blue-600" />
        <span class="text-blue-600">Saved!</span>
      {:else}
        <Icon icon="mdi:content-save" class="w-4 h-4 text-blue-600" />
        <span class="text-blue-600">Save Settings</span>
      {/if}
    </button>
  </div>
</div>
{/if} 