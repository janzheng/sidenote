<script lang="ts">
  import Icon from "@iconify/svelte";
  import { panelManager } from '../ui/panelManager.svelte';
  import type { TabData } from '../../types/tabData';
  import type { PageMetadata } from '../../types/pageMetadata';

  // Reactive state using $state
  let inputContent = $state('');
  let title = $state('');
  let author = $state('');
  let url = $state('');
  let isSubmitting = $state(false);
  let submitStatus = $state<'idle' | 'success' | 'error'>('idle');
  let error = $state<string | null>(null);

  // Derived state using $derived
  const wordCount = $derived(inputContent.trim().split(/\s+/).filter(word => word.length > 0).length);
  const characterCount = $derived(inputContent.length);
  const canSubmit = $derived(inputContent.trim().length > 0 && !isSubmitting);
  const hasContent = $derived(inputContent.trim().length > 0);

  // Auto-populate from current panel content if available
  $effect(() => {
    if (panelManager.content?.text && !inputContent) {
      inputContent = panelManager.content.text;
    }
  });

  $effect(() => {
    if (panelManager.title && !title) {
      title = panelManager.title;
    }
  });

  $effect(() => {
    if (panelManager.url && !url) {
      url = panelManager.url;
    }
  });

  async function setManualContent() {
    if (!canSubmit) {
      return;
    }

    isSubmitting = true;
    submitStatus = 'idle';
    error = null;

    try {
      console.log('📝 Setting manual content...');

      // Generate HTML content
      const htmlContent = `<div class="manual-content">
        ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
        ${author ? `<div class="author">By: ${escapeHtml(author)}</div>` : ''}
        <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(inputContent.trim())}</pre>
      </div>`;

      // Create metadata
      const metadata: PageMetadata = {
        title: title || 'Manual Input',
        author: author || '',
        description: inputContent.trim().substring(0, 200) + (inputContent.length > 200 ? '...' : ''),
        language: 'en'
      };

      // Use current tab URL or generate manual URL
      const contentUrl = url || `manual://input/${Date.now()}`;

      // Create tab data structure
      const tabData: Partial<TabData> = {
        content: {
          url: contentUrl,
          text: inputContent.trim(),
          html: htmlContent,
          markdown: inputContent.trim(), // Use original text as markdown for manual input
          title: title || 'Manual Input',
          metadata: metadata,
          wordCount: wordCount,
          extractedAt: Date.now()
        },
        analysis: {
          summary: null,
          citations: null,
          researchPaper: null,
          contentStructure: null
        },
        processing: {
          summary: { isStreaming: false, error: null },
          citations: { isGenerating: false, error: null },
          researchPaper: { isExtracting: false, progress: '', error: null }
        }
      };

      // Send to background script for processing and storage
      const response = await chrome.runtime.sendMessage({
        action: 'setManualContent',
        tabId: panelManager.tabId,
        url: contentUrl,
        data: tabData
      });

      if (response?.success) {
        console.log('✅ Manual content set successfully');
        submitStatus = 'success';
        
        // Clear form after successful submission
        setTimeout(() => {
          clearInput();
          submitStatus = 'idle';
        }, 2000);

        // Refresh panel to show new content
        setTimeout(() => {
          panelManager.refresh();
        }, 500);
      } else {
        console.error('❌ Failed to set manual content:', response?.error);
        error = response?.error || 'Failed to set manual content';
        submitStatus = 'error';
      }

    } catch (err) {
      console.error('❌ Error setting manual content:', err);
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      submitStatus = 'error';
    } finally {
      isSubmitting = false;
    }
  }

  function clearInput() {
    inputContent = '';
    title = '';
    author = '';
    url = '';
    error = null;
    submitStatus = 'idle';
  }

  function handlePaste(event: Event) {
    setTimeout(() => {
      if (inputContent.length > 1000) {
        const lines = inputContent.split('\n');
        const firstLine = lines[0]?.trim();
        if (firstLine && firstLine.length < 200 && !title) {
          if (!firstLine.endsWith('.') && firstLine.length > 10) {
            title = firstLine;
          }
        }
      }
    }, 10);
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getSubmitButtonClass() {
    if (submitStatus === 'success') {
      return 'px-3 py-2 bg-green-100 text-green-900 rounded hover:bg-green-200 transition-colors flex items-center gap-2 justify-center border border-green-300';
    } else if (submitStatus === 'error') {
      return 'px-3 py-2 bg-red-100 text-red-900 rounded hover:bg-red-200 transition-colors flex items-center gap-2 justify-center border border-red-300';
    }
    return 'px-3 py-2 border border-gray-100 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center';
  }
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between mt-4 mb-8">
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Manual Content Input</h2>
      <p class="text-gray-600 dark:text-gray-400 mt-1">
        Paste content from embedded PDFs, images, or other sources that can't be automatically extracted
      </p>
    </div>
  </div>

  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6 flex-1 flex flex-col">
    <div class="space-y-4 flex-1 flex flex-col">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="manual-title" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title (optional)
          </label>
          <input 
            id="manual-title"
            type="text" 
            bind:value={title}
            placeholder="Document title..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label for="manual-author" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Author (optional)
          </label>
          <input 
            id="manual-author"
            type="text" 
            bind:value={author}
            placeholder="Author name..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label for="manual-url" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">
          Source URL (optional)
        </label>
        <input 
          id="manual-url"
          type="url" 
          bind:value={url}
          placeholder="https://example.com/document"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div class="flex-1 flex flex-col">
        <label for="manual-content" class="block font-medium text-gray-700 dark:text-gray-300 mb-1">
          Content *
        </label>
        <textarea 
          id="manual-content"
          rows={10}
          bind:value={inputContent}
          onpaste={handlePaste}
          placeholder="Paste or type your content here..."
          class="flex-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono resize-none"
          required
        ></textarea>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {characterCount.toLocaleString()} characters, 
          {wordCount.toLocaleString()} words
        </div>
      </div>

      {#if error}
        <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-700 dark:text-red-300 flex items-center">
            <Icon icon="mdi:alert" class="w-4 h-4 mr-1" />
            {error}
          </p>
        </div>
      {/if}

      <div class="flex items-center gap-2 pt-2">
        <button 
          onclick={setManualContent}
          disabled={!canSubmit}
          class={getSubmitButtonClass()}
        >
          {#if isSubmitting}
            <Icon icon="mdi:loading" class="animate-spin w-6 h-6 text-blue-600" />
            <span class="font-semibold px-2 py-1 text-blue-600">Setting Content</span>
          {:else if submitStatus === 'success'}
            <Icon icon="mdi:check" class="w-6 h-6 text-green-600" />
            <span class="font-semibold px-2 py-1 text-green-600">Content Set!</span>
          {:else if submitStatus === 'error'}
            <Icon icon="mdi:alert" class="w-6 h-6 text-red-600" />
            <span class="font-semibold px-2 py-1 text-red-600">Try Again</span>
          {:else}
            <Icon icon="mdi:check" class="w-6 h-6 text-blue-600" />
            <span class="font-semibold px-2 py-1 text-blue-600">Set Content</span>
          {/if}
        </button>
        
        <button 
          onclick={clearInput}
          disabled={isSubmitting}
          class="px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      <div class="text-gray-600 dark:text-gray-400 border-t pt-3">
        <p class="mb-1"><strong>Notes</strong></p>
        <ul class="space-y-1 ml-4">
          <li>• Paste content from embedded PDFs, images, or any other source</li>
          <li>• Title will be auto-detected from the first line if it looks like a title</li>
          <li>• Content will be processed and stored for the current tab</li>
          <li>• Use the refresh button to reload after setting content</li>
        </ul>
      </div>
    </div>
  </div>
</div>
