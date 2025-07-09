<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import { parseContent } from '../services/parseContent';
  import type { ContentNode } from '../services/parseContent';

  // Props from DebugPanel (matching ContentStructure pattern)
  interface Props {
    content: any | null;
    isLoading: boolean;
    error: string | null;
  }
  
  let { content, isLoading, error }: Props = $props();

  // Component state
  let isExpanded = $state(false);
  let expandedSections = $state(new Set<string>());
  
  // Store parsed content structure in reactive state
  let parsedContentStructure = $state<any>(null);
  let lastContentHash = $state<string>('');

  // Effect to re-parse when content changes and drawer is open
  $effect(() => {
    // Create a hash of the current content to detect changes
    const currentContentHash = content?.html ? content.html.slice(0, 100) + content.html.length : '';
    
    // Only re-parse if content actually changed and drawer is open
    if (isExpanded && content?.html && !hasStructure && currentContentHash !== lastContentHash) {
      console.log('ContentReader: Content changed while drawer is open, re-parsing...');
      lastContentHash = currentContentHash;
      
      // Reset parsed structure and re-parse
      parsedContentStructure = null;
      try {
        const parsed = parseContent({ html: content.html });
        console.log('ContentReader: Re-parse result:', parsed);
        if (parsed.error) {
          console.warn('ContentReader: Re-parsing error:', parsed.error);
        } else if (parsed.contentStructure) {
          // Store the parsed result in reactive state
          parsedContentStructure = parsed.contentStructure;
          console.log('ContentReader: Stored re-parsed structure:', parsedContentStructure);
        }
      } catch (error) {
        console.error('ContentReader: Error during content re-parsing:', error);
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
      console.log('ContentReader: Drawer opened, triggering content parsing...');
      // Force parsing by calling parseContent directly
      try {
        const parsed = parseContent({ html: content.html });
        console.log('ContentReader: Parse result:', parsed);
        if (parsed.error) {
          console.warn('ContentReader: Parsing error:', parsed.error);
        } else if (parsed.contentStructure) {
          // Store the parsed result in reactive state
          parsedContentStructure = parsed.contentStructure;
          console.log('ContentReader: Stored parsed structure:', parsedContentStructure);
        }
      } catch (error) {
        console.error('ContentReader: Error during manual parsing:', error);
      }
    }
  }

  // Parse content structure using the service
  const basicStructure = $derived(() => {
    if (!hasStructure && !parsedContentStructure && content?.html) {
      console.log('ContentReader: basicStructure derived - attempting to parse content');
      try {
        const parsed = parseContent({ html: content.html });
        console.log('ContentReader: basicStructure parse result:', parsed);
        if (parsed.error) {
          console.warn('ContentReader: Parsing error:', parsed.error);
          return null;
        }
        return parsed.contentStructure;
      } catch (error) {
        console.error('ContentReader: Error parsing content structure:', error);
        return null;
      }
    }
    return null;
  });

  const displayStructure = $derived(contentStructure || parsedContentStructure || basicStructure);

  // Get all expandable header IDs (only H2s since H1s are always open)
  const allExpandableHeaderIds = $derived(() => {
    if (!displayStructure?.root) return new Set<string>();
    
    const headerIds = new Set<string>();
    function collectHeaderIds(node: ContentNode) {
      if (node.type === 'header' && node.level === 2) {
        headerIds.add(node.id);
      }
      for (const child of node.children) {
        collectHeaderIds(child);
      }
    }
    
    collectHeaderIds(displayStructure.root);
    return headerIds;
  });

  // Check if all sections are expanded
  const allExpanded = $derived(() => {
    const headerIds = allExpandableHeaderIds();
    if (headerIds.size === 0) return false;
    return headerIds.size === expandedSections.size &&
           [...headerIds].every(id => expandedSections.has(id));
  });

  // Toggle section expansion
  function toggleSection(nodeId: string) {
    if (expandedSections.has(nodeId)) {
      expandedSections.delete(nodeId);
    } else {
      expandedSections.add(nodeId);
    }
    expandedSections = new Set(expandedSections);
  }

  // Expand/collapse all sections
  function toggleAllSections() {
    if (allExpanded()) {
      expandedSections = new Set();
    } else {
      expandedSections = new Set(allExpandableHeaderIds());
    }
  }

  // Render markdown content safely
  function renderMarkdown(content: string): string {
    try {
      const result = marked.parse(content);
      return typeof result === 'string' ? result : content;
    } catch (error) {
      console.warn('Markdown rendering error:', error);
      return content;
    }
  }

  // Render inline markdown (for headers) - removes paragraph tags
  function renderInlineMarkdown(content: string | undefined): string {
    if (!content) return '';
    try {
      const result = marked.parseInline(content);
      return typeof result === 'string' ? result : content;
    } catch (error) {
      console.warn('Inline markdown rendering error:', error);
      return content;
    }
  }

  // Get all nodes to display based on current expansion state - FIXED VERSION
  function getDisplayNodes(): ContentNode[] {
    if (!displayStructure?.root.children) return [];
    
    const result: ContentNode[] = [];
    
    function processNode(node: ContentNode, depth: number = 0): void {
      // Always add the current node to results
      result.push(node);
      
      // Determine if we should show children based on node type and expansion state
      let shouldShowChildren = false;
      
      if (node.type === 'header') {
        if (node.level === 1) {
          // H1s are always expanded
          shouldShowChildren = true;
        } else if (node.level === 2) {
          // H2s only show children if expanded
          shouldShowChildren = expandedSections.has(node.id);
        } else {
          // H3+ headers are always expanded (not collapsible)
          shouldShowChildren = true;
        }
      } else if (node.type === 'content') {
        // Content nodes don't have collapsible children, but we still process them
        shouldShowChildren = true;
      }
      
      // Process children if we should show them
      if (shouldShowChildren && node.children && node.children.length > 0) {
        for (const child of node.children) {
          processNode(child, depth + 1);
        }
      }
    }
    
    // Process all top-level nodes
    for (const node of displayStructure.root.children) {
      processNode(node);
    }
    
    return result;
  }

  // Get nodes to display
  const displayNodes = $derived(getDisplayNodes());
</script>

<ToggleDrawer 
  title="Content Reader" 
  subtitle="Read structured content"
  bind:isExpanded
  onToggle={handleDrawerToggle}
>
  <div class="reader-container">
    {#if structureParsingError}
      <div class="error-state">
        <Icon icon="mdi:alert-circle" class="w-4 h-4" />
        <div>
          <div class="error-title">Structure Parsing Error</div>
          <div class="error-message">{structureParsingError}</div>
        </div>
      </div>
    {:else if displayStructure}
      <div class="reader-controls">
        <button 
          class="expand-collapse-btn"
          onclick={toggleAllSections}
          title={allExpanded() ? 'Collapse all sections' : 'Expand all sections'}
        >
          <Icon icon={allExpanded() ? "mdi:book-open" : "mdi:book-multiple"} class="w-5 h-5" />
          <span class="font-medium">
            {allExpanded() ? 'Collapse All' : 'Expand All'}
          </span>
        </button>
      </div>
      
      <div class="document">
        {#each displayNodes as node (node.id)}
          {#if node.type === 'header'}
            {#if node.level === 1}
              <h1 class="heading-1">
                {@html renderInlineMarkdown(node.title)}
              </h1>
            {:else if node.level === 2}
              <h2 class="heading-2">
                <button 
                  class="clickable-header"
                  onclick={() => toggleSection(node.id)}
                  title="Click to {expandedSections.has(node.id) ? 'collapse' : 'expand'} section"
                >
                  <Icon 
                    icon={expandedSections.has(node.id) ? "mdi:chevron-down" : "mdi:chevron-right"} 
                    class="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" 
                  />
                  {@html renderInlineMarkdown(node.title)}
                </button>
              </h2>
            {:else if node.level === 3}
              <h3 class="heading-3">{@html renderInlineMarkdown(node.title)}</h3>
            {:else if node.level === 4}
              <h4 class="heading-4">{@html renderInlineMarkdown(node.title)}</h4>
            {:else if node.level === 5}
              <h5 class="heading-5">{@html renderInlineMarkdown(node.title)}</h5>
            {:else if node.level === 6}
              <h6 class="heading-6">{@html renderInlineMarkdown(node.title)}</h6>
            {/if}
          {:else if node.type === 'content'}
            <div class="content-block">
              {#if node.markdown}
                {@html renderMarkdown(node.markdown)}
              {:else if node.content}
                <p class="content-text">{node.content}</p>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {:else if !content?.html}
      <div class="empty-state">
        <Icon icon="mdi:file-document-outline" class="w-8 h-8 opacity-50" />
        <div class="empty-title">No content available</div>
        <div class="empty-description">
          Content will appear here once extracted from the page
        </div>
      </div>
    {:else if isParsingStructure}
      <div class="loading-state">
        <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
        <div>Parsing content structure...</div>
      </div>
    {:else}
      <div class="empty-state">
        <Icon icon="mdi:file-tree" class="w-8 h-8 opacity-50" />
        <div class="empty-title">Document Reader</div>
        <div class="empty-description">
          Parse the document structure to enable clean, focused reading with collapsible sections.
        </div>
      </div>
    {/if}
  </div>
</ToggleDrawer>

<style>
  .reader-container {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    min-height: 120px;
    max-height: 600px;
    overflow-y: auto;
  }

  .reader-controls {
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 6px 6px 0 0;
  }

  .expand-collapse-btn {
    background: #f3f4f6;
    color: #1f2937;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    width: 100%;
  }

  .expand-collapse-btn:hover {
    background: #e5e7eb;
  }

  .error-state {
    padding: 16px;
    background: #fef2f2;
    border-radius: 4px;
    margin: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #dc2626;
  }

  .error-title {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .error-message {
    font-size: 14px;
    opacity: 0.8;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: #3b82f6;
    gap: 8px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: #6b7280;
    text-align: center;
    gap: 8px;
  }

  .empty-title {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .empty-description {
    font-size: 12px;
    opacity: 0.75;
    max-width: 240px;
    line-height: 1.4;
  }

  .document {
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #1f2937;
    max-width: 100%;
  }

  /* Clickable header button */
  .clickable-header {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: color 0.2s ease;
  }

  .clickable-header:hover {
    color: #3b82f6;
  }

  /* Headers */
  .heading-1 {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    line-height: 1.2;
    margin: 32px 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #e5e7eb;
  }

  .heading-1:first-child,
  .heading-1:first-of-type {
    margin-top: 0;
  }

  .heading-2 {
    font-size: 20px;
    font-weight: 600;
    color: #374151;
    line-height: 1.3;
    margin: 24px 0 12px 0;
  }

  .heading-2:first-child,
  .heading-2:first-of-type {
    margin-top: 0;
  }

  .heading-3 {
    font-size: 18px;
    font-weight: 600;
    color: #4b5563;
    line-height: 1.4;
    margin: 20px 0 10px 0;
  }

  .heading-3:first-child,
  .heading-3:first-of-type {
    margin-top: 0;
  }

  .heading-4 {
    font-size: 16px;
    font-weight: 600;
    color: #6b7280;
    line-height: 1.4;
    margin: 16px 0 8px 0;
  }

  .heading-5 {
    font-size: 15px;
    font-weight: 600;
    color: #6b7280;
    line-height: 1.4;
    margin: 14px 0 6px 0;
  }

  .heading-6 {
    font-size: 14px;
    font-weight: 600;
    color: #9ca3af;
    line-height: 1.4;
    margin: 12px 0 4px 0;
  }

  /* Content */
  .content-block {
    margin: 0 0 16px 0;
  }

  .content-text {
    font-size: 15px;
    line-height: 1.7;
    color: #374151;
    margin: 0 0 16px 0;
  }

  /* Markdown content styling */
  .content-block :global(p) {
    font-size: 15px;
    line-height: 1.7;
    color: #374151;
    margin: 0 0 16px 0;
  }

  .content-block :global(p:last-child) {
    margin-bottom: 0;
  }

  .content-block :global(ul),
  .content-block :global(ol) {
    margin: 0 0 16px 0;
    padding-left: 24px;
  }

  .content-block :global(ul) {
    list-style-type: disc;
  }

  .content-block :global(ol) {
    list-style-type: decimal;
  }

  .content-block :global(li) {
    font-size: 15px;
    line-height: 1.6;
    color: #374151;
    margin-bottom: 6px;
    display: list-item;
  }

  .content-block :global(blockquote) {
    border-left: 4px solid #e5e7eb;
    padding-left: 16px;
    margin: 16px 0;
    color: #6b7280;
    font-style: italic;
  }

  .content-block :global(code) {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 14px;
    color: #1f2937;
  }

  .content-block :global(pre) {
    background: #f8fafc;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 16px 0;
    border: 1px solid #e2e8f0;
  }

  .content-block :global(pre code) {
    background: none;
    padding: 0;
    font-size: 13px;
  }

  .content-block :global(a) {
    color: #3b82f6;
    text-decoration: none;
  }

  .content-block :global(a:hover) {
    text-decoration: underline;
  }

  .content-block :global(strong) {
    font-weight: 600;
    color: #111827;
  }

  .content-block :global(em) {
    font-style: italic;
  }

  .content-block :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
  }

  .content-block :global(th),
  .content-block :global(td) {
    border: 1px solid #e5e7eb;
    padding: 8px 12px;
    text-align: left;
  }

  .content-block :global(th) {
    background: #f9fafb;
    font-weight: 600;
  }

  /* Additional styles for inline markdown in headers */
  .heading-1 :global(em),
  .heading-2 :global(em),
  .heading-3 :global(em),
  .heading-4 :global(em),
  .heading-5 :global(em),
  .heading-6 :global(em) {
    font-style: italic;
  }

  .heading-1 :global(strong),
  .heading-2 :global(strong),
  .heading-3 :global(strong),
  .heading-4 :global(strong),
  .heading-5 :global(strong),
  .heading-6 :global(strong) {
    font-weight: inherit;
  }

  .heading-1 :global(code),
  .heading-2 :global(code),
  .heading-3 :global(code),
  .heading-4 :global(code),
  .heading-5 :global(code),
  .heading-6 :global(code) {
    background: #f3f4f6;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 0.9em;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .reader-container {
      background: #1f2937;
      border-color: #374151;
    }

    .reader-controls {
      background: #111827;
      border-bottom-color: #374151;
    }

    .expand-collapse-btn {
      background: #374151;
      color: #f9fafb;
    }

    .expand-collapse-btn:hover {
      background: #4b5563;
    }

    .error-state {
      background: #7f1d1d;
      color: #fca5a5;
    }

    .loading-state {
      color: #60a5fa;
    }

    .empty-state {
      color: #9ca3af;
    }

    .document {
      color: #f9fafb;
    }

    .heading-1 {
      color: #f9fafb;
      border-bottom-color: #374151;
    }

    .heading-2 {
      color: #e5e7eb;
    }

    .clickable-header:hover {
      color: #60a5fa;
    }

    .heading-3 {
      color: #d1d5db;
    }

    .heading-4,
    .heading-5 {
      color: #9ca3af;
    }

    .heading-6 {
      color: #6b7280;
    }

    .content-text {
      color: #e5e7eb;
    }

    .content-block :global(p) {
      color: #e5e7eb;
    }

    .content-block :global(li) {
      color: #e5e7eb;
    }

    .content-block :global(blockquote) {
      border-left-color: #374151;
      color: #9ca3af;
    }

    .content-block :global(code) {
      background: #374151;
      color: #f9fafb;
    }

    .content-block :global(pre) {
      background: #111827;
      border-color: #374151;
    }

    .content-block :global(strong) {
      color: #f9fafb;
    }

    .content-block :global(a) {
      color: #60a5fa;
    }

    .content-block :global(th),
    .content-block :global(td) {
      border-color: #374151;
    }

    .content-block :global(th) {
      background: #374151;
    }

    .heading-1 :global(code),
    .heading-2 :global(code),
    .heading-3 :global(code),
    .heading-4 :global(code),
    .heading-5 :global(code),
    .heading-6 :global(code) {
      background: #374151;
      color: inherit;
    }
  }
</style>
