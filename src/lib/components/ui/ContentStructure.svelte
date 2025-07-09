<script lang="ts">
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ToggleDrawer.svelte';
  import CopyButton from './CopyButton.svelte';
  import type { ContentNode } from '../../../types/contentNode';
  import { parseContent } from '../../services/parseContent';

  // Props from DebugPanel
  interface Props {
    content: any | null;
    isLoading: boolean;
    error: string | null;
  }
  
  let { content, isLoading, error }: Props = $props();

  // Component state
  let isExpanded = $state(false);
  let expandedNodes = $state(new Set<string>());
  let draggedNode = $state<ContentNode | null>(null);
  let dragOverNode = $state<ContentNode | null>(null);
  
  // Store parsed content structure in reactive state
  let parsedContentStructure = $state<any>(null);
  let lastContentHash = $state<string>('');

  // Effect to re-parse when content changes and drawer is open
  $effect(() => {
    // Create a hash of the current content to detect changes
    const currentContentHash = content?.html ? content.html.slice(0, 100) + content.html.length : '';
    
    // Only re-parse if content actually changed and drawer is open
    if (isExpanded && content?.html && !hasStructure && currentContentHash !== lastContentHash) {
      console.log('ContentStructure: Content changed while drawer is open, re-parsing...');
      lastContentHash = currentContentHash;
      
      // Reset parsed structure and re-parse
      parsedContentStructure = null;
      try {
        const parsed = parseContent({ html: content.html });
        console.log('ContentStructure: Re-parse result:', parsed);
        if (parsed.error) {
          console.warn('ContentStructure: Re-parsing error:', parsed.error);
        } else if (parsed.contentStructure) {
          // Store the parsed result in reactive state
          parsedContentStructure = parsed.contentStructure;
          console.log('ContentStructure: Stored re-parsed structure:', parsedContentStructure);
        }
      } catch (error) {
        console.error('ContentStructure: Error during content re-parsing:', error);
      }
    }
  });

  // Derive content structure from content
  const contentStructure = $derived(content?.contentStructure || null);
  const hasStructure = $derived(!!contentStructure);
  const isParsingStructure = $derived(isLoading);
  const structureParsingError = $derived(error);

  // Handle drawer toggle - trigger parsing when opened
  function handleDrawerToggle(isExpanded: boolean) {
    if (isExpanded && content?.html && !hasStructure && !parsedContentStructure) {
      console.log('ContentStructure: Drawer opened, triggering content parsing...');
      // Force parsing by calling parseContent directly
      try {
        const parsed = parseContent({ html: content.html });
        console.log('ContentStructure: Parse result:', parsed);
        if (parsed.error) {
          console.warn('ContentStructure: Parsing error:', parsed.error);
        } else if (parsed.contentStructure) {
          // Store the parsed result in reactive state
          parsedContentStructure = parsed.contentStructure;
          console.log('ContentStructure: Stored parsed structure:', parsedContentStructure);
        }
      } catch (error) {
        console.error('ContentStructure: Error during manual parsing:', error);
      }
    }
  }

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

  // Parse content structure using the service
  const basicStructure = $derived(() => {
    if (!hasStructure && !parsedContentStructure && content?.html) {
      console.log('ContentStructure: basicStructure derived - attempting to parse content');
      try {
        const parsed = parseContent({ html: content.html });
        console.log('ContentStructure: basicStructure parse result:', parsed);
        if (parsed.error) {
          console.warn('ContentStructure: Parsing error:', parsed.error);
          return null;
        }
        return parsed.contentStructure;
      } catch (error) {
        console.error('ContentStructure: Error parsing content structure:', error);
        return null;
      }
    }
    return null;
  });

  const displayStructure = $derived(contentStructure || parsedContentStructure || basicStructure);
</script>

<ToggleDrawer 
  title="Content Structure" 
  subtitle="Navigate doc hierarchy"
  bind:isExpanded
  onToggle={handleDrawerToggle}
>
  <!-- Control Buttons -->
  <div class="space-y-3 mb-4">
    {#if displayStructure}
      <!-- Level Controls -->
      <div class="flex gap-1">
        <button onclick={() => expandLevel(1)} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold">
          H1s
        </button>
        <button onclick={() => expandLevel(2)} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold">
          H2s
        </button>
        <button onclick={() => expandLevel(3)} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold">
          H3s
        </button>
        <button onclick={collapseAll} class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold">
          Collapse
        </button>
      </div>
      
      <!-- Copy Controls -->
      <div class="flex gap-1">
        <button onclick={() => copyStructure('html')} class="flex-1 px-2 py-1 border border-gray-700 hover:border-gray-800 hover:bg-gray-50 text-gray-700 rounded font-semibold flex items-center justify-center gap-1">
          <Icon icon="mdi:content-copy" class="w-4 h-4" />
          HTML
        </button>
        <button onclick={() => copyStructure('text')} class="flex-1 px-2 py-1 border border-gray-700 hover:border-gray-800 hover:bg-gray-50 text-gray-700 rounded font-semibold flex items-center justify-center gap-1">
          <Icon icon="mdi:content-copy" class="w-4 h-4" />
          Text
        </button>
      </div>
    {/if}
  </div>

  <!-- Content Display -->
  <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded border min-h-[120px] max-h-[400px] overflow-y-auto">
    {#if structureParsingError}
      <div class="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
        <Icon icon="mdi:alert-circle" class="w-4 h-4" />
        <div>
          <div class="font-medium">Structure Parsing Error</div>
          <div class="text-sm opacity-75">{structureParsingError}</div>
        </div>
      </div>
    {:else if displayStructure}
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
    {:else if !content?.html}
      <div class="text-gray-500 italic text-sm text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:file-document-outline" class="w-8 h-8 opacity-50" />
        <div>No content available</div>
      </div>
    {:else if isParsingStructure}
      <div class="text-blue-600 dark:text-blue-400 text-sm flex items-center gap-2 justify-center py-8">
        <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
        <div>Parsing content structure...</div>
      </div>
    {:else}
      <div class="text-gray-500 italic text-sm text-center py-8 flex flex-col items-center gap-2">
        <Icon icon="mdi:file-tree" class="w-8 h-8 opacity-50" />
        <div class="font-medium">Content Structure</div>
        <div class="text-sm opacity-75 max-w-xs text-center">
          Analyzing document hierarchy...
        </div>
      </div>
    {/if}
  </div>
</ToggleDrawer> 