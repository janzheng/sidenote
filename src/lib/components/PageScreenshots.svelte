<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import { pageAssetsManager } from '../ui/pageAssetsManager.svelte';
  import type { ScreenshotInfo } from '../../types/pageAssets';

  interface Props {
    url: string | null;
    content: any;
    screenshots: ScreenshotInfo | null;
    isExtracting: boolean;
    onRefresh?: () => void;
  }

  let { url, content, screenshots, isExtracting, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);

  // Derived states
  const hasScreenshots = $derived(screenshots && (screenshots.pageshot || screenshots.screenshot));
  const canGenerate = $derived(url && url.startsWith('http'));

  // Handle pageshot generation
  async function handleGeneratePageshot() {
    if (!url || pageAssetsManager.isGeneratingPageshot) {
      return;
    }

    await pageAssetsManager.handleGeneratePageshot(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle screenshot generation
  async function handleGenerateScreenshot() {
    if (!url || pageAssetsManager.isGeneratingScreenshot) {
      return;
    }

    await pageAssetsManager.handleGenerateScreenshot(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle copying screenshot URL
  async function handleCopyScreenshot(imageUrl: string, type: string) {
    try {
      await navigator.clipboard.writeText(imageUrl);
      console.log(`📋 ${type} URL copied to clipboard`);
    } catch (error) {
      console.error(`Failed to copy ${type} URL:`, error);
    }
  }

  // Handle opening image in new tab
  function handleOpenImage(imageUrl: string, type: string) {
    window.open(imageUrl, '_blank');
    console.log(`🖼️ Opened ${type} in new tab`);
  }

  // Get button states
  const getPageshotButtonState = $derived(() => {
    if (pageAssetsManager.isGeneratingPageshot) {
      return { icon: 'mdi:loading', text: 'Generating...', class: 'animate-spin' };
    } else if (pageAssetsManager.pageshotStatus === 'success') {
      return { icon: 'mdi:check', text: 'Pageshot', class: '' };
    } else if (pageAssetsManager.pageshotStatus === 'error') {
      return { icon: 'mdi:alert', text: 'Pageshot', class: '' };
    } else {
      return { icon: 'mdi:camera-outline', text: 'Pageshot', class: '' };
    }
  });

  const getScreenshotButtonState = $derived(() => {
    if (pageAssetsManager.isGeneratingScreenshot) {
      return { icon: 'mdi:loading', text: 'Generating...', class: 'animate-spin' };
    } else if (pageAssetsManager.screenshotStatus === 'success') {
      return { icon: 'mdi:check', text: 'Screenshot', class: '' };
    } else if (pageAssetsManager.screenshotStatus === 'error') {
      return { icon: 'mdi:alert', text: 'Screenshot', class: '' };
    } else {
      return { icon: 'mdi:monitor-screenshot', text: 'Screenshot', class: '' };
    }
  });
</script>

<ToggleDrawer
  title="Page Screenshots"
  bind:isExpanded
>
  {#snippet children()}
    <!-- About Section -->
    <div class="py-2">
      Capture visual screenshots of the page using Jina AI. Generate both full page shots and viewport screenshots for documentation and analysis.
    </div>

    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={handleGeneratePageshot}
        class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canGenerate || pageAssetsManager.isGeneratingPageshot}
        title={pageAssetsManager.pageshotError || 'Generate Full Page Screenshot'}
      >
        <Icon icon={getPageshotButtonState().icon} class="w-6 h-6 text-blue-600 {getPageshotButtonState().class}" />
        <span class="font-semibold px-2 py-1 text-blue-600">{getPageshotButtonState().text}</span>
      </button>
      
      <button 
        onclick={handleGenerateScreenshot}
        class="flex-1 px-3 py-2 bg-transparent border-2 border-gray-300 text-gray-600 rounded hover:border-blue-500 hover:text-blue-600 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canGenerate || pageAssetsManager.isGeneratingScreenshot}
        title={pageAssetsManager.screenshotError || 'Generate Viewport Screenshot'}
      >
        <Icon icon={getScreenshotButtonState().icon} class="w-6 h-6 {getScreenshotButtonState().class}" />
        <span class="font-semibold px-2 py-1">{getScreenshotButtonState().text}</span>
      </button>
    </div>

    <!-- URL Warning -->
    {#if !canGenerate && url}
      <div class="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4">
        <div class="text-yellow-600 flex items-center gap-2">
          <Icon icon="mdi:information" class="w-5 h-5" />
          <div>
            <div class="font-medium">HTTP/HTTPS URLs Only</div>
            <div class="text-sm opacity-75">Jina screenshots only work with HTTP and HTTPS URLs</div>
          </div>
        </div>
      </div>
    {:else if !url}
      <div class="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4">
        <div class="text-yellow-600 flex items-center gap-2">
          <Icon icon="mdi:information" class="w-5 h-5" />
          <div>
            <div class="font-medium">No URL Available</div>
            <div class="text-sm opacity-75">No page URL available for capture</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Error Messages -->
    {#if pageAssetsManager.pageshotError}
      <div class="bg-red-50 border border-red-200 p-3 rounded mb-4">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">Pageshot Error</div>
            <div class="text-sm opacity-75">{pageAssetsManager.pageshotError}</div>
          </div>
        </div>
      </div>
    {/if}

    {#if pageAssetsManager.screenshotError}
      <div class="bg-red-50 border border-red-200 p-3 rounded mb-4">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">Screenshot Error</div>
            <div class="text-sm opacity-75">{pageAssetsManager.screenshotError}</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Screenshot Results -->
    {#if hasScreenshots}
      <div class="space-y-4">
        
        {#if screenshots?.pageshot}
          <div class="bg-gray-50 p-3 rounded border">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-medium text-gray-700">Full Page Screenshot</h4>
              <div class="flex items-center gap-2">
                <CopyButton 
                  content={screenshots.pageshot}
                  title="Copy image URL"
                  buttonClass="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  iconClass="w-4 h-4"
                />
                <button 
                  onclick={() => handleOpenImage(screenshots.pageshot || '', 'pageshot')}
                  class="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
                  title="Open in new tab"
                >
                  <Icon icon="mdi:open-in-new" class="w-4 h-4" />
                  Open
                </button>
              </div>
            </div>
            <div class="relative">
              <button 
                onclick={() => handleOpenImage(screenshots.pageshot || '', 'pageshot')}
                class="block w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                title="Click to open image in new tab"
              >
                <img 
                  src={screenshots.pageshot} 
                  alt="Full page screenshot" 
                  class="w-full h-auto rounded border border-gray-200 max-h-48 object-contain bg-white cursor-pointer"
                  loading="lazy"
                />
              </button>
            </div>
          </div>
        {/if}

        {#if screenshots?.screenshot}
          <div class="bg-gray-50 p-3 rounded border">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-medium text-gray-700">Viewport Screenshot</h4>
              <div class="flex items-center gap-2">
                <CopyButton 
                  content={screenshots.screenshot}
                  title="Copy image URL"
                  buttonClass="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  iconClass="w-4 h-4"
                />
                <button 
                  onclick={() => handleOpenImage(screenshots.screenshot || '', 'screenshot')}
                  class="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
                  title="Open in new tab"
                >
                  <Icon icon="mdi:open-in-new" class="w-4 h-4" />
                  Open
                </button>
              </div>
            </div>
            <div class="relative">
              <button 
                onclick={() => handleOpenImage(screenshots.screenshot || '', 'screenshot')}
                class="block w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                title="Click to open image in new tab"
              >
                <img 
                  src={screenshots.screenshot} 
                  alt="Viewport screenshot" 
                  class="w-full h-auto rounded border border-gray-200 max-h-48 object-contain bg-white cursor-pointer"
                  loading="lazy"
                />
              </button>
            </div>
          </div>
        {/if}

        {#if screenshots?.capturedAt}
          <div class="text-xs text-gray-500 text-center">
            Captured {new Date(screenshots.capturedAt).toLocaleString()}
          </div>
        {/if}
      </div>
    {:else if !canGenerate}
      <div class="text-gray-500 italic text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:camera-off" class="w-8 h-8 opacity-50" />
        <div>Screenshots not available</div>
        <div class="text-xs">Only HTTP/HTTPS URLs are supported</div>
      </div>
    {/if}
  {/snippet}
</ToggleDrawer>

<style>
  /* Ensure images don't break layout */
  img {
    max-width: 100%;
    height: auto;
  }
</style> 