<script lang="ts">
  import { PDFDownloadService, type PDFDownloadOptions } from '../../services/pdfDownloadService.svelte';
  import type { TabData } from '../../../types/tabData';

  // Props
  interface Props {
    url: string;
    title?: string;
    filename?: string;
    tabData?: TabData;
    buttonClass?: string;
    showText?: boolean;
    showFilename?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'outline';
  }

  let { 
    url, 
    title, 
    filename, 
    tabData,
    buttonClass = '', 
    showText = true,
    showFilename = true,
    size = 'md',
    variant = 'outline'
  }: Props = $props();

  // Component state using $state
  let isDownloading = $state(false);
  let downloadError = $state<string | null>(null);
  let downloadSuccess = $state(false);

  // Computed properties using $derived
  const canDownload = $derived(PDFDownloadService.canDownloadPDF(url));
  const buttonText = $derived(PDFDownloadService.getDownloadButtonText(url, isDownloading));
  const displayFilename = $derived(PDFDownloadService.generateDisplayFilename({
    url,
    title,
    tabData
  }));
  
  // Size classes
  const sizeClasses = $derived(() => {
    switch (size) {
      case 'sm': return 'px-2 py-1 text-xs';
      case 'lg': return 'px-6 py-3 text-base';
      default: return 'px-4 py-2 text-sm';
    }
  });
  
  // Variant classes
  const variantClasses = $derived(() => {
    const base = 'border rounded transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    switch (variant) {
      case 'primary':
        return `${base} bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700`;
      case 'secondary':
        return `${base} bg-gray-600 text-white border-gray-600 hover:bg-gray-700 hover:border-gray-700`;
      default: // outline
        return `${base} bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400`;
    }
  });
  
  // Icon size based on button size
  const iconSize = $derived(() => {
    switch (size) {
      case 'sm': return 'w-3 h-3';
      case 'lg': return 'w-6 h-6';
      default: return 'w-4 h-4';
    }
  });

  // Download function
  async function handleDownload() {
    if (!canDownload || isDownloading) return;
    
    isDownloading = true;
    downloadError = null;
    downloadSuccess = false;
    
    try {
      const options: PDFDownloadOptions = {
        url,
        title,
        filename,
        tabData
      };
      
      const result = await PDFDownloadService.downloadPDF(options);
      
      if (result.success) {
        downloadSuccess = true;
        console.log('✅ PDF download completed:', result.filename);
        
        // Reset success state after a few seconds
        setTimeout(() => {
          downloadSuccess = false;
        }, 3000);
      } else {
        downloadError = result.error || 'Download failed';
        console.error('❌ PDF download failed:', downloadError);
        
        // Reset error state after a few seconds
        setTimeout(() => {
          downloadError = null;
        }, 5000);
      }
    } catch (error) {
      downloadError = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ PDF download error:', downloadError);
      
      setTimeout(() => {
        downloadError = null;
      }, 5000);
    } finally {
      isDownloading = false;
    }
  }
</script>

{#if canDownload}
  <div class="flex items-center gap-2">
    <button 
      onclick={handleDownload}
      class="{sizeClasses()} {variantClasses()} {buttonClass}"
      class:bg-green-600={downloadSuccess && variant === 'primary'}
      class:border-green-600={downloadSuccess && variant === 'primary'}
      class:hover:bg-green-700={downloadSuccess && variant === 'primary'}
      class:bg-green-50={downloadSuccess && variant === 'outline'}
      class:border-green-500={downloadSuccess && variant === 'outline'}
      class:text-green-700={downloadSuccess && variant === 'outline'}
      class:bg-red-600={downloadError && variant === 'primary'}
      class:border-red-600={downloadError && variant === 'primary'}
      class:bg-red-50={downloadError && variant === 'outline'}
      class:border-red-500={downloadError && variant === 'outline'}
      class:text-red-700={downloadError && variant === 'outline'}
      disabled={isDownloading}
      title={downloadError || (downloadSuccess ? 'Download completed!' : `Download PDF from ${url}`)}
    >
      {#if isDownloading}
        <svg class="{iconSize()} animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {:else if downloadSuccess}
        <svg class="{iconSize()}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      {:else if downloadError}
        <svg class="{iconSize()}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
      {:else}
        <svg class="{iconSize()}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      {/if}
      
      {#if showText}
        <span class="truncate">
          {#if downloadSuccess}
            Downloaded!
          {:else if downloadError}
            Failed
          {:else}
            {buttonText}
          {/if}
        </span>
      {/if}
    </button>
    
    {#if showFilename}
      <span class="text-xs text-gray-500 truncate max-w-48" title={displayFilename}>
        {displayFilename}
      </span>
    {/if}
  </div>
{/if} 