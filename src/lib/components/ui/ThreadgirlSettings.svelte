<script lang="ts">
  import { settingsManager } from '../../ui/settings.svelte';
  import Icon from "@iconify/svelte";

  // Track if user has interacted with settings
  let hasInteracted = $state(false);

  // Show settings if any Threadgirl setting is missing
  // But only hide automatically if user hasn't interacted yet
  const shouldShowSettings = $derived(
    hasInteracted ||
    !settingsManager.settings.threadgirlPipelineUrl?.trim() ||
    !settingsManager.settings.threadgirlSheetUrl?.trim() ||
    !settingsManager.settings.threadgirlSheetName?.trim()
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
<!-- Threadgirl Configuration -->
<div class="space-y-3 py-3 px-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
  <div class="font-medium text-gray-700 dark:text-gray-300">
    Threadgirl Configuration
  </div>
  
  <div class="space-y-2">
    <label for="threadgirl-pipeline-url" class="block text-sm font-medium text-gray-600 dark:text-gray-400">
      Pipeline URL
    </label>
    <input 
      type="url" 
      id="threadgirl-pipeline-url"
      class="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none"
      placeholder=""
      bind:value={settingsManager.settings.threadgirlPipelineUrl}
      oninput={() => {
        handleInteraction();
        settingsManager.updateSetting('threadgirlPipelineUrl', settingsManager.settings.threadgirlPipelineUrl);
      }}
      onfocus={handleInteraction}
    />
  </div>
  
  <div class="space-y-2">
    <label for="threadgirl-sheet-url" class="block text-sm font-medium text-gray-600 dark:text-gray-400">
      Prompts Sheet URL
    </label>
    <input 
      type="url" 
      id="threadgirl-sheet-url"
      class="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none"
      placeholder="https://script.google.com/macros/s/..."
      bind:value={settingsManager.settings.threadgirlSheetUrl}
      oninput={() => {
        handleInteraction();
        settingsManager.updateSetting('threadgirlSheetUrl', settingsManager.settings.threadgirlSheetUrl);
      }}
      onfocus={handleInteraction}
    />
  </div>
  
  <div class="space-y-2">
    <label for="threadgirl-sheet-name" class="block text-sm font-medium text-gray-600 dark:text-gray-400">
      Prompts Sheet Name
    </label>
    <input 
      type="text" 
      id="threadgirl-sheet-name"
      class="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white outline-none"
      placeholder="Capsid Toolbox Prompts"
      bind:value={settingsManager.settings.threadgirlSheetName}
      oninput={() => {
        handleInteraction();
        settingsManager.updateSetting('threadgirlSheetName', settingsManager.settings.threadgirlSheetName);
      }}
      onfocus={handleInteraction}
    />
  </div>
  
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