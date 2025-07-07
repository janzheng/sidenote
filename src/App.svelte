<script lang="ts">
  import '@fontsource-variable/eb-garamond';
  import { onMount, onDestroy } from "svelte";
  import { panelManager } from './lib/ui/panelManager.svelte';
  
  onMount(async () => {
    // Panel manager initializes itself
  });

  onDestroy(() => {
    panelManager.cleanup();
  });
</script>

<div class="flex flex-col bg-paper min-h-screen">
  <!-- Main Content -->
  <main class="flex-1 px-2 overflow-auto flex flex-col gap-2 min-h-0 flex-grow">
    {#if panelManager.isLoading}
      <div class="p-4 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p class="mt-2">Loading content...</p>
      </div>
    {:else if panelManager.error}
      <div class="p-4 text-center">
        <div class="text-red-600 mb-2">❌ Error</div>
        <p class="text-sm text-gray-600 mb-4">{panelManager.error}</p>
        <button 
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onclick={() => panelManager.refresh()}
        >
          Retry
        </button>
      </div>
    {:else if panelManager.content}
      <div class="p-4">
        <div class="mb-4">
          <h2 class="text-xl font-bold mb-2">{panelManager.title}</h2>
          <div class="text-sm text-gray-600 space-y-1">
            <p><strong>URL:</strong> {panelManager.url}</p>
            <p><strong>Tab ID:</strong> {panelManager.tabId}</p>
            <p><strong>Word count:</strong> {panelManager.content.text?.split(' ').length || 0}</p>
          </div>
        </div>
        
        <div class="border-t pt-4">
          <h3 class="font-semibold mb-2">Content Preview:</h3>
          <p class="text-sm bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
            {panelManager.content.text?.substring(0, 500)}...
          </p>
        </div>
        
        <div class="mt-4">
          <button 
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onclick={() => panelManager.refresh()}
          >
            Refresh Content
          </button>
        </div>
      </div>
    {:else}
      <div class="p-4 text-center text-gray-500">
        <p>No content available</p>
        <button 
          class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onclick={() => panelManager.refresh()}
        >
          Load Content
        </button>
      </div>
    {/if}
  </main>
</div>
