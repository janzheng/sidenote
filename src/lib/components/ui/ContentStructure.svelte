<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ToggleDrawer.svelte';
  import CopyButton from './CopyButton.svelte';
  import type { ContentNode } from '../../../types/contentNode';
  import { contentStructureManager } from '../../ui/contentStructureManager.svelte';

  // Props from DebugPanel
  interface Props {
    url: string | null;
    content: any | null;
    contentStructure?: any | null;
    isLoading: boolean;
    error: string | null;
    onRefresh?: () => void;
  }
  
  let { url, content, contentStructure, isLoading, error, onRefresh }: Props = $props();

  // Component state
  let isExpanded = $state(false);
  let expandedNodes = $state(new Set<string>());
  let draggedNode = $state<ContentNode | null>(null);
  let dragOverNode = $state<ContentNode | null>(null);
  
  // Store parsed content structure in reactive state
  let parsedContentStructure = $state<any>(null);
  let lastContentHash = $state<string>('');
  let lastUrl = $state<string>('');

  // Derived states
  const hasContentStructure = $derived(!!contentStructure);
  const canExtract = $derived(url && content && content.html && content.html.length > 0);
  const isExtracting = $derived(isLoading || contentStructureManager.isParsing);

  // Effect to clear structure when URL changes (like AI Summary)
  $effect(() => {
    if (url && url !== lastUrl) {
      console.log('ContentStructure: URL changed, clearing local structure', { oldUrl: lastUrl, newUrl: url });
      lastUrl = url;
      parsedContentStructure = null;
      lastContentHash = '';
      expandedNodes.clear();
      expandedNodes = new Set(expandedNodes);
    }
  });

  // Handle content structure extraction
  async function handleExtractStructure() {
    if (!url || contentStructureManager.isParsing) {
      return;
    }

    await contentStructureManager.handleParseContentStructure(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // No automatic parsing - only manual extraction like AI Summary

  // Derive content structure from multiple sources  
  const isParsingStructure = $derived(isLoading);
  const structureParsingError = $derived(error);

  // No automatic drawer toggle parsing - only manual extraction

  // Toggle node expansion
  function toggleNode(nodeId: string) {
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    expandedNodes = new Set(expandedNodes); // Trigger reactivity
  }

  // Get content to copy for a node
  function getNodeCopyContent(node: ContentNode): string {
    if (node.type === 'header') {
      return node.title || '';
    } else if (node.type === 'content') {
      return node.content || '';
    }
    return '';
  }

  // Handle keyboard events for accessibility
  function handleKeydown(event: KeyboardEvent, nodeId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleNode(nodeId);
    }
  }

  // Expand all nodes at a specific level
  function expandLevel(level: number) {
    if (!displayStructure) return;
    
    // Find all headers at the specified level and expand them
    const headersAtLevel = displayStructure.root.children.filter((node: ContentNode) => 
      node.type === 'header' && node.level === level
    );
    
    headersAtLevel.forEach((header: ContentNode) => {
      expandedNodes.add(header.id);
    });
    
    expandedNodes = new Set(expandedNodes); // Trigger reactivity
  }

  // Collapse all nodes
  function collapseAll() {
    expandedNodes.clear();
    expandedNodes = new Set(expandedNodes);
  }

  // Copy structure to clipboard
  async function copyStructure(format: 'text' | 'markdown' | 'html') {
    if (!displayStructure) return;
    
    // Create a simple flattened representation
    let flattened = '';
    
    function flattenNode(node: ContentNode, indent = 0): void {
      const indentStr = '  '.repeat(indent);
      
      if (node.type === 'header') {
        switch (format) {
          case 'text':
            flattened += `${indentStr}${node.title}\n`;
            break;
          case 'markdown':
            flattened += `${'#'.repeat(node.level || 1)} ${node.title}\n`;
            break;
          case 'html':
            flattened += `<h${node.level}>${node.title}</h${node.level}>\n`;
            break;
        }
      } else if (node.type === 'content' && node.content) {
        switch (format) {
          case 'text':
            flattened += `${indentStr}${node.content}\n`;
            break;
          case 'markdown':
            flattened += `${node.content}\n`;
            break;
          case 'html':
            flattened += `<p>${node.content}</p>\n`;
            break;
        }
      }
      
      // Process children
      node.children.forEach((child: ContentNode) => flattenNode(child, indent + 1));
    }
    
    // Start flattening from root children
    displayStructure.root.children.forEach((child: ContentNode) => flattenNode(child));
    
    try {
      await navigator.clipboard.writeText(flattened);
      console.log(`ContentStructure: Copied structure as ${format} to clipboard`);
    } catch (error) {
      console.error('ContentStructure: Failed to copy to clipboard:', error);
      // Fallback: show alert with content
      alert(`Failed to copy to clipboard. Content:\n\n${flattened.substring(0, 500)}...`);
    }
  }

  // Helper functions
  function getNodeDepth(node: ContentNode): number {
    return node.level || 0;
  }

  function getNodeIcon(node: ContentNode): string {
    if (node.type === 'header') {
      return node.level === 1 ? '📚' : node.level === 2 ? '📖' : node.level === 3 ? '📄' : '📝';
    }
    return '📄';
  }

  function getWordCountColor(wordCount: number): string {
    if (wordCount < 50) return 'text-gray-500';
    if (wordCount < 200) return 'text-blue-500';
    if (wordCount < 500) return 'text-green-500';
    return 'text-purple-500';
  }

  // Check if node has expandable content
  function hasExpandableContent(node: ContentNode): boolean {
    return (node.type === 'content' && !!node.content) || node.children.length > 0;
  }

  // Priority: passed contentStructure (from background storage) > local parsed structure
  // No automatic parsing - only manual extraction like AI Summary
  const displayStructure = $derived(contentStructure || parsedContentStructure);
</script>

<ToggleDrawer 
  title="Content Structure" 
  bind:isExpanded
>
  {#snippet children()}
    <!-- About Section -->
    <div class="py-2">
      Extract and navigate the hierarchical structure of the page content. Perfect for understanding document organization and quickly jumping to sections.
    </div>

    <!-- Control Buttons -->
    <div class="flex gap-2 mb-4">
      <button 
        onclick={handleExtractStructure}
        class="flex-1 px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canExtract || isExtracting}
        title={contentStructureManager.parseError || 'Extract Content Structure'}
      >
        {#if isExtracting}
          <Icon icon="mdi:loading" class="animate-spin w-8 h-8" />
          Extracting...
        {:else}
          <Icon icon="mdi:file-tree" class="w-8 h-8 text-blue-600" />
          <span class="font-semibold px-2 py-1 text-blue-600">{hasContentStructure ? 'Re-extract' : 'Extract'}</span>
        {/if}
      </button>
      
      {#if displayStructure && !isExtracting}
        <button 
          onclick={() => copyStructure('text')}
          class="px-3 py-2 text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
          title="Copy structure as text"
        >
          <Icon icon="mdi:content-copy" class="w-6 h-6" />
        </button>
      {/if}
    </div>

    <!-- Level Controls (when structure exists) -->
    {#if displayStructure && !isExtracting}
      <div class="flex gap-1 mb-4">
        <button onclick={() => expandLevel(1)} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs">
          H1s
        </button>
        <button onclick={() => expandLevel(2)} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs">
          H2s
        </button>
        <button onclick={() => expandLevel(3)} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs">
          H3s
        </button>
        <button onclick={collapseAll} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs">
          Collapse
        </button>
      </div>
    {/if}

    <!-- Content Display -->
    {#if contentStructureManager.parseError}
      <div class="bg-red-50 border border-red-200 p-3 rounded">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">Structure Extraction Error</div>
            <div class="text-sm opacity-75">{contentStructureManager.parseError}</div>
          </div>
        </div>
      </div>
    {:else if displayStructure}
      <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded border min-h-[120px] max-h-[400px] overflow-y-auto">
        <!-- Stats -->
        <div class="flex gap-4 mb-3 text-sm text-gray-600 dark:text-gray-400">
          <span>{displayStructure?.stats?.totalNodes || 0} nodes</span>
          <span>{displayStructure?.stats?.headerCount || 0} headers</span>
          <span>{displayStructure?.stats?.contentSections || 0} sections</span>
          <span>depth {displayStructure?.stats?.maxDepth || 0}</span>
        </div>

        <!-- Structure Tree -->
        <div class="space-y-1" role="tree" aria-label="Content structure tree">
          {#each displayStructure?.root?.children || [] as node (node.id)}
            <div 
              class="rounded transition-colors"
              class:bg-blue-100={dragOverNode?.id === node.id}
              role="treeitem"
              tabindex="0"
              aria-expanded={expandedNodes.has(node.id)}
              aria-selected="false"
              aria-label={`${node.title || 'Content'} - ${node.wordCount || 0} words`}
            >
              <div 
                class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm"
                role="button"
                tabindex="0"
                aria-expanded={expandedNodes.has(node.id)}
                onclick={() => toggleNode(node.id)}
                onkeydown={(e) => handleKeydown(e, node.id)}
              >
                <span class="text-base">{getNodeIcon(node)}</span>
                <span class="flex-1 font-medium" class:text-lg={node.level === 1} class:text-base={node.level === 2} class:text-sm={node.level === 3}>
                  {node.title || 'Content'}
                </span>
                {#if node.wordCount}
                  <span class="text-sm {getWordCountColor(node.wordCount)}">
                    {node.wordCount}w
                  </span>
                {/if}
                <!-- Copy Button -->
                <button 
                  type="button"
                  onclick={(e) => e.stopPropagation()}
                  class="inline-flex items-center justify-center"
                  aria-label="Copy {node.type === 'header' ? 'title' : 'content'}"
                >
                  <CopyButton
                    content={getNodeCopyContent(node)}
                    buttonClass="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-500 opacity-60 hover:opacity-100"
                    iconClass="w-3 h-3"
                    title="Copy {node.type === 'header' ? 'title' : 'content'}"
                  />
                </button>
                {#if hasExpandableContent(node)}
                  <span class="text-sm text-gray-500">
                    {expandedNodes.has(node.id) ? '▼' : '▶'}
                  </span>
                {/if}
              </div>
              
              {#if expandedNodes.has(node.id)}
                <!-- Content preview for expanded content nodes -->
                {#if node.type === 'content' && node.content}
                  <div class="ml-6 mt-2 p-3 bg-gray-100 dark:bg-gray-600 rounded text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-l-2 border-blue-400">
                    <div class="whitespace-pre-wrap">{node.content}</div>
                  </div>
                {/if}
                
                <!-- Recursively render children -->
                {#if node.children && node.children.length > 0}
                  <div class="ml-4 mt-2 space-y-1">
                    {#each node.children as childNode (childNode.id)}
                      <div 
                        class="rounded transition-colors"
                        role="treeitem"
                        tabindex="0"
                        aria-expanded={expandedNodes.has(childNode.id)}
                        aria-selected="false"
                        aria-label={`${childNode.title || 'Content'} - ${childNode.wordCount || 0} words`}
                      >
                        <div 
                          class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm"
                          role="button"
                          tabindex="0"
                          aria-expanded={expandedNodes.has(childNode.id)}
                          onclick={() => toggleNode(childNode.id)}
                          onkeydown={(e) => handleKeydown(e, childNode.id)}
                        >
                          <span class="text-sm">{getNodeIcon(childNode)}</span>
                          <span class="flex-1 font-medium text-sm" class:text-base={childNode.level === 2} class:text-sm={childNode.level === 3}>
                            {childNode.title || 'Content'}
                          </span>
                          {#if childNode.wordCount}
                            <span class="text-xs {getWordCountColor(childNode.wordCount)}">
                              {childNode.wordCount}w
                            </span>
                          {/if}
                          <!-- Copy Button -->
                          <button 
                            type="button"
                            onclick={(e) => e.stopPropagation()}
                            class="inline-flex items-center justify-center"
                            aria-label="Copy {childNode.type === 'header' ? 'title' : 'content'}"
                          >
                            <CopyButton
                              content={getNodeCopyContent(childNode)}
                              buttonClass="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-500 opacity-60 hover:opacity-100"
                              iconClass="w-3 h-3"
                              title="Copy {childNode.type === 'header' ? 'title' : 'content'}"
                            />
                          </button>
                          {#if hasExpandableContent(childNode)}
                            <span class="text-xs text-gray-500">
                              {expandedNodes.has(childNode.id) ? '▼' : '▶'}
                            </span>
                          {/if}
                        </div>
                        
                        {#if expandedNodes.has(childNode.id)}
                          <!-- Content preview for expanded content nodes -->
                          {#if childNode.type === 'content' && childNode.content}
                            <div class="ml-6 mt-2 p-3 bg-gray-100 dark:bg-gray-600 rounded text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-l-2 border-green-400">
                              <div class="whitespace-pre-wrap">{childNode.content}</div>
                            </div>
                          {/if}
                          
                          <!-- Recursively render grandchildren -->
                          {#if childNode.children && childNode.children.length > 0}
                            <div class="ml-4 mt-2 space-y-1">
                              {#each childNode.children as grandChildNode (grandChildNode.id)}
                                <div 
                                  class="rounded transition-colors"
                                  role="treeitem"
                                  tabindex="0"
                                  aria-expanded={expandedNodes.has(grandChildNode.id)}
                                  aria-selected="false"
                                  aria-label={`${grandChildNode.title || 'Content'} - ${grandChildNode.wordCount || 0} words`}
                                >
                                  <div 
                                    class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-xs"
                                    role="button"
                                    tabindex="0"
                                    aria-expanded={expandedNodes.has(grandChildNode.id)}
                                    onclick={() => toggleNode(grandChildNode.id)}
                                    onkeydown={(e) => handleKeydown(e, grandChildNode.id)}
                                  >
                                    <span class="text-xs">{getNodeIcon(grandChildNode)}</span>
                                    <span class="flex-1 font-medium text-xs">
                                      {grandChildNode.title || 'Content'}
                                    </span>
                                    {#if grandChildNode.wordCount}
                                      <span class="text-xs {getWordCountColor(grandChildNode.wordCount)}">
                                        {grandChildNode.wordCount}w
                                      </span>
                                    {/if}
                                    <!-- Copy Button -->
                                    <button 
                                      type="button"
                                      onclick={(e) => e.stopPropagation()}
                                      class="inline-flex items-center justify-center"
                                      aria-label="Copy {grandChildNode.type === 'header' ? 'title' : 'content'}"
                                    >
                                      <CopyButton
                                        content={getNodeCopyContent(grandChildNode)}
                                        buttonClass="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-500 opacity-60 hover:opacity-100"
                                        iconClass="w-2 h-2"
                                        title="Copy {grandChildNode.type === 'header' ? 'title' : 'content'}"
                                      />
                                    </button>
                                    {#if hasExpandableContent(grandChildNode)}
                                      <span class="text-xs text-gray-500">
                                        {expandedNodes.has(grandChildNode.id) ? '▼' : '▶'}
                                      </span>
                                    {/if}
                                  </div>
                                  
                                  {#if expandedNodes.has(grandChildNode.id)}
                                    <!-- Content preview for expanded content nodes -->
                                    {#if grandChildNode.type === 'content' && grandChildNode.content}
                                      <div class="ml-6 mt-2 p-3 bg-gray-100 dark:bg-gray-600 rounded text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-l-2 border-yellow-400">
                                        <div class="whitespace-pre-wrap">{grandChildNode.content}</div>
                                      </div>
                                    {/if}
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          {/if}
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {:else if !canExtract}
      <div class="text-gray-500 italic text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:file-document-outline" class="w-8 h-8 opacity-50" />
        <div>No page content available to extract structure</div>
        {#if !url}
          <div class="text-xs">Waiting for page URL...</div>
        {:else if !content?.html}
          <div class="text-xs">No HTML content found</div>
        {/if}
      </div>
    {/if}
  {/snippet}
</ToggleDrawer> 