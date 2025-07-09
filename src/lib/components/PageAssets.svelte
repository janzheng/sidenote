<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import { pageAssetsManager } from '../ui/pageAssetsManager.svelte';
  import type { FontInfo, ImageInfo, SvgInfo, PageAssets } from '../../types/pageAssets';

  interface Props {
    url: string | null;
    content: any;
    pageAssets: PageAssets | null;
    isExtracting: boolean;
    onRefresh?: () => void;
  }

  let { url, content, pageAssets, isExtracting, onRefresh }: Props = $props();

  // Component state
  let isExpanded = $state(false);
  let selectedTab = $state<'fonts' | 'images' | 'svgs'>('images');
  let expandedItems = $state(new Set<string>());
  let imageDimensions = $state(new Map<string, { width: number; height: number }>());
  let loadingDimensions = $state(new Set<string>());

  // Derived states from props
  const fonts = $derived(pageAssets?.fonts || []);
  const images = $derived(pageAssets?.images || []);
  const svgs = $derived(pageAssets?.svgs || []);
  const stats = $derived(pageAssets?.stats);
  const hasPageAssets = $derived(!!pageAssets && (fonts.length > 0 || images.length > 0 || svgs.length > 0));
  const canExtract = $derived(url && content && content.html && content.html.length > 0);

  // Auto-select first available tab
  $effect(() => {
    const availableTabs = [];
    if (fonts.length > 0) availableTabs.push('fonts');
    if (images.length > 0) availableTabs.push('images');
    if (svgs.length > 0) availableTabs.push('svgs');

    if (availableTabs.length > 0 && !availableTabs.includes(selectedTab)) {
      selectedTab = availableTabs[0] as any;
    }
  });

  // Load image dimensions when images change
  $effect(() => {
    if (images.length > 0) {
      images.forEach((image: ImageInfo) => {
        // Skip if we already have dimensions or are currently loading
        if (imageDimensions.has(image.id) || loadingDimensions.has(image.id)) {
          return;
        }
        
        // Skip if the image already has dimensions
        if (image.width && image.height) {
          imageDimensions.set(image.id, { width: image.width, height: image.height });
          return;
        }
        
        loadImageDimensions(image);
      });
    }
  });

  // Load actual image dimensions
  async function loadImageDimensions(imageInfo: ImageInfo) {
    if (loadingDimensions.has(imageInfo.id)) return;
    
    loadingDimensions.add(imageInfo.id);
    
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Try to avoid CORS issues
      
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 5000); // 5 second timeout
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load image'));
        };
        
        img.src = imageInfo.src;
      });
      
      imageDimensions.set(imageInfo.id, dimensions);
      imageDimensions = new Map(imageDimensions); // Trigger reactivity
    } catch (error) {
      console.warn(`Failed to load dimensions for image ${imageInfo.id}:`, error);
    } finally {
      loadingDimensions.delete(imageInfo.id);
      loadingDimensions = new Set(loadingDimensions); // Trigger reactivity
    }
  }

  // Get image dimensions (from loaded data or original)
  function getImageDimensions(image: ImageInfo): { width: number; height: number } | null {
    // First check loaded dimensions
    const loaded = imageDimensions.get(image.id);
    if (loaded) return loaded;
    
    // Fall back to original dimensions if available
    if (image.width && image.height) {
      return { width: image.width, height: image.height };
    }
    
    return null;
  }

  // Handle asset extraction
  async function handleExtractAssets() {
    if (!url || pageAssetsManager.isExtracting) {
      return;
    }

    await pageAssetsManager.handleExtractPageAssets(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Toggle item expansion
  function toggleItem(id: string) {
    if (expandedItems.has(id)) {
      expandedItems.delete(id);
    } else {
      expandedItems.add(id);
    }
    expandedItems = new Set(expandedItems);
  }

  // Handle copying with logging
  async function handleCopyWithLog(text: string, successMessage: string) {
    await navigator.clipboard.writeText(text);
    console.log(successMessage);
  }

  // Handle image click (open in new tab)
  function handleImageClick(src: string) {
    window.open(src, '_blank');
  }

  // Handle SVG download
  function handleSvgDownload(svg: SvgInfo) {
    const filename = svg.title ? `${svg.title.replace(/\s+/g, '-').toLowerCase()}.svg` : `svg-${svg.id}.svg`;
    const blob = new Blob([svg.code], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Handle copying all assets as JSON
  async function handleCopyAssets() {
    const assetsData = {
      url: url || '',
      title: content?.title || '',
      extractedAt: new Date().toISOString(),
      stats: stats,
      fonts: fonts,
      images: images,
      svgs: svgs
    };

    const jsonData = JSON.stringify(assetsData, null, 2);
    await navigator.clipboard.writeText(jsonData);
    console.log('Assets JSON copied to clipboard!');
  }

  // Get font element icon
  function getFontElementIcon(element: string): string {
    switch (element) {
      case 'h1': return 'mdi:format-header-1';
      case 'h2': return 'mdi:format-header-2';
      case 'h3': return 'mdi:format-header-3';
      case 'h4': return 'mdi:format-header-4';
      case 'h5': return 'mdi:format-header-5';
      case 'h6': return 'mdi:format-header-6';
      case 'body': return 'mdi:format-text';
      default: return 'mdi:format-font';
    }
  }

  // Get SVG context icon
  function getSvgContextIcon(context: SvgInfo['context']): string {
    switch (context) {
      case 'icon': return 'mdi:star-circle';
      case 'illustration': return 'mdi:palette';
      case 'background': return 'mdi:image-filter-hdr';
      default: return 'mdi:svg';
    }
  }

  // Format dimensions
  function formatDimensions(width?: number | string, height?: number | string): string {
    if (width && height) {
      return `${width} × ${height}`;
    }
    return 'Unknown';
  }
</script>

<ToggleDrawer 
  title="Page Assets" 
  subtitle="Fonts, images, and SVGs"
  bind:isExpanded
>
  {#snippet children()}
    <!-- About Section -->
    <div class="py-2">
      Extract and analyze fonts, images, and SVGs from the page. Analyze typography, save images, and copy SVG code for design workflows.
    </div>

    <!-- Extract Button -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={handleExtractAssets}
        class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canExtract || isExtracting || pageAssetsManager.isExtracting}
        title={pageAssetsManager.extractionError || 'Extract Page Assets'}
      >
        {#if isExtracting || pageAssetsManager.isExtracting}
          <Icon icon="mdi:loading" class="animate-spin w-6 h-6 text-blue-600" />
          <span class="font-semibold px-2 py-1 text-blue-600">Extracting Assets...</span>
        {:else}
          <Icon icon="mdi:image-multiple" class="w-6 h-6 text-blue-600" />
          <span class="font-semibold px-2 py-1 text-blue-600">Extract Assets</span>
        {/if}
      </button>
    </div>

    <!-- Content Display -->
    {#if pageAssetsManager.extractionError}
      <div class="bg-red-50 border border-red-200 p-3 rounded">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">Asset Extraction Error</div>
            <div class="text-sm opacity-75">{pageAssetsManager.extractionError}</div>
          </div>
        </div>
      </div>
    {:else if hasPageAssets && stats}
      <!-- Control Buttons -->
      <div class="space-y-3 mb-4">
        <!-- Tab Navigation -->
        <div class="flex gap-1">
          {#if fonts.length > 0}
            <button 
              onclick={() => selectedTab = 'fonts'}
              class="flex-1 px-2 py-1 rounded font-semibold transition-colors"
              class:bg-blue-100={selectedTab === 'fonts'}
              class:text-blue-700={selectedTab === 'fonts'}
              class:bg-gray-100={selectedTab !== 'fonts'}
              class:text-gray-700={selectedTab !== 'fonts'}
              class:hover:bg-gray-200={selectedTab !== 'fonts'}
            >
              Fonts ({fonts.length})
            </button>
          {/if}
          {#if images.length > 0}
            <button 
              onclick={() => selectedTab = 'images'}
              class="flex-1 px-2 py-1 rounded font-semibold transition-colors"
              class:bg-blue-100={selectedTab === 'images'}
              class:text-blue-700={selectedTab === 'images'}
              class:bg-gray-100={selectedTab !== 'images'}
              class:text-gray-700={selectedTab !== 'images'}
              class:hover:bg-gray-200={selectedTab !== 'images'}
            >
              Images ({images.length})
            </button>
          {/if}
          {#if svgs.length > 0}
            <button 
              onclick={() => selectedTab = 'svgs'}
              class="flex-1 px-2 py-1 rounded font-semibold transition-colors"
              class:bg-blue-100={selectedTab === 'svgs'}
              class:text-blue-700={selectedTab === 'svgs'}
              class:bg-gray-100={selectedTab !== 'svgs'}
              class:text-gray-700={selectedTab !== 'svgs'}
              class:hover:bg-gray-200={selectedTab !== 'svgs'}
            >
              SVGs ({svgs.length})
            </button>
          {/if}
        </div>
        
        <!-- Export Controls -->
        <div class="flex gap-1">
          <CopyButton 
            copyFn={handleCopyAssets}
            buttonClass="flex-1 px-2 py-1 border border-gray-700 hover:border-gray-800 hover:bg-gray-50 text-gray-700 rounded font-semibold flex items-center justify-center gap-1"
            iconClass="w-4 h-4"
            title="Copy all assets as JSON"
          >
            JSON
          </CopyButton>
        </div>
      </div>

      <!-- Content Area -->
      <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded border min-h-[120px] max-h-[400px] overflow-y-auto">
        <div class="space-y-3">
          {#if selectedTab === 'fonts'}
            {#if fonts.length > 0}
              <div class="space-y-2">
                {#each fonts as font (font.id)}
                  <div class="bg-white dark:bg-gray-600 p-3 rounded border">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2 flex-1">
                        <Icon icon={getFontElementIcon(font.element)} class="w-4 h-4" />
                        <span class="font-medium">{font.family}</span>
                      </div>
                      <CopyButton 
                        copyFn={() => handleCopyWithLog(font.css || `${font.element} {\n  font-family: ${font.family};\n}`, 'Font CSS copied!')}
                        buttonClass="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-500 opacity-60 hover:opacity-100"
                        iconClass="w-3 h-3"
                        title="Copy CSS"
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center text-gray-500 py-8">No fonts found</div>
            {/if}

          {:else if selectedTab === 'images'}
            {#if images.length > 0}
              <div class="space-y-3">
                {#each images as image (image.id)}
                  <div class="bg-white dark:bg-gray-600 p-3 rounded border">
                    <div class="flex gap-3">
                      <!-- Image Preview -->
                      <div class="flex-shrink-0">
                        <button 
                          class="w-16 h-16 bg-gray-200 dark:bg-gray-500 rounded border cursor-pointer overflow-hidden"
                          onclick={() => handleImageClick(image.src)}
                          title="Click to open full size"
                        >
                          <img 
                            src={image.src} 
                            alt={image.alt}
                            class="w-full h-full object-cover"
                            loading="lazy"
                            onerror={(e) => { 
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-center p-1"><div class="text-xs text-gray-600 dark:text-gray-300">${image.filename || image.alt || 'Image'}</div></div>`;
                              }
                            }}
                          />
                        </button>
                      </div>

                      <!-- Image Info -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between">
                          <CopyButton 
                            copyFn={() => handleCopyWithLog(image.src, 'Image URL copied!')}
                            buttonClass="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-500 opacity-60 hover:opacity-100"
                            iconClass="w-3 h-3"
                            title="Copy URL"
                          />
                        </div>
                        
                        {#if image.alt}
                          <div class="mt-1 text-sm text-gray-700 dark:text-gray-300 break-words">{image.alt}</div>
                        {/if}
                        
                        {#if image.caption}
                          <div class="mt-1 text-sm text-gray-600 dark:text-gray-400 italic break-words">{image.caption}</div>
                        {/if}
                        
                        <!-- Image Dimensions -->
                        <div class="mt-1 text-xs text-gray-500">
                          {#if loadingDimensions.has(image.id)}
                            <span class="flex items-center gap-1">
                              <Icon icon="mdi:loading" class="animate-spin w-3 h-3" />
                              Loading dimensions...
                            </span>
                          {:else}
                            {@const dims = getImageDimensions(image)}
                            {#if dims}
                              {formatDimensions(dims.width, dims.height)}
                            {:else}
                              <button 
                                onclick={() => loadImageDimensions(image)}
                                class="text-blue-600 hover:text-blue-800 underline"
                              >
                                Load dimensions
                              </button>
                            {/if}
                          {/if}
                        </div>
                        
                        {#if image.filename}
                          <div class="mt-1 max-h-12 overflow-y-auto">
                            <a 
                              href={image.src}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-xs text-blue-600 dark:text-blue-400 font-mono hover:underline break-words block"
                              title="Click to open image in new tab"
                            >
                              {image.filename}
                            </a>
                          </div>
                        {/if}
                        
                        <div class="mt-2 text-xs text-gray-500 break-words max-h-16 overflow-y-auto" title="Full URL">{image.src}</div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center text-gray-500 py-8">No images found</div>
            {/if}

          {:else if selectedTab === 'svgs'}
            {#if svgs.length > 0}
              <div class="space-y-3">
                {#each svgs as svg (svg.id)}
                  <div class="bg-white dark:bg-gray-600 p-3 rounded border">
                    <div class="flex gap-3">
                      <!-- SVG Preview -->
                      <div class="flex-shrink-0">
                        <div class="w-16 h-16 bg-white border rounded overflow-hidden">
                          {@html svg.code}
                        </div>
                      </div>

                      <!-- SVG Info -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between">
                          <div class="flex items-center gap-2">
                            <Icon icon={getSvgContextIcon(svg.context)} class="w-4 h-4" />
                            <span class="text-sm font-medium">{svg.context}</span>
                            {#if svg.viewBox}
                              <span class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-500 rounded">{svg.viewBox}</span>
                            {/if}
                          </div>
                          <div class="flex gap-1">
                            <CopyButton 
                              copyFn={() => handleCopyWithLog(svg.code, 'SVG code copied!')}
                              buttonClass="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-500 opacity-60 hover:opacity-100"
                              iconClass="w-3 h-3"
                              title="Copy SVG Code"
                            />
                            <button 
                              onclick={() => handleSvgDownload(svg)}
                              class="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-500 opacity-60 hover:opacity-100"
                              title="Download SVG"
                            >
                              <Icon icon="mdi:download" class="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        
                        {#if svg.title}
                          <div class="mt-1 text-sm text-gray-700 dark:text-gray-300 font-medium">{svg.title}</div>
                        {/if}
                        
                        {#if svg.description}
                          <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">{svg.description}</div>
                        {/if}
                        
                        {#if svg.width || svg.height}
                          <div class="mt-1 text-xs text-gray-500">{formatDimensions(svg.width, svg.height)}</div>
                        {/if}
                        
                        <button 
                          onclick={() => toggleItem(svg.id)}
                          class="mt-2 text-xs text-blue-600 hover:text-blue-800"
                        >
                          {expandedItems.has(svg.id) ? 'Hide' : 'Show'} SVG Code
                        </button>
                        
                        {#if expandedItems.has(svg.id)}
                          <div class="mt-2 p-2 bg-gray-100 dark:bg-gray-500 rounded text-xs font-mono overflow-x-auto">
                            <pre>{svg.code}</pre>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center text-gray-500 py-8">No SVGs found</div>
            {/if}

          {/if}
        </div>
      </div>
    {:else if !canExtract}
      <div class="text-gray-500 italic text-sm text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:file-document-outline" class="w-8 h-8 opacity-50" />
        <div>No HTML content available to extract assets from</div>
        {#if !url}
          <div class="text-xs">Waiting for page URL...</div>
        {:else if !content?.html}
          <div class="text-xs">No HTML content found</div>
        {/if}
      </div>
    {:else if isExtracting || pageAssetsManager.isExtracting}
      <div class="text-blue-600 dark:text-blue-400 text-sm flex items-center gap-2 justify-center py-8">
        <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
        <div>Extracting page assets...</div>
      </div>
    {:else}
      <div class="text-gray-500 italic text-sm text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:image-multiple" class="w-8 h-8 opacity-50" />
        <div>Click "Extract Assets" to analyze page fonts, images, and SVGs</div>
      </div>
    {/if}
  {/snippet}
</ToggleDrawer> 