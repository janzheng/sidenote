// Content parsing service for extracting structured content from HTML
// Designed to work with ContentStructure component props

import type { ContentNode } from '../../types/contentNode';
import type { ContentGraph } from '../../types/contentGraph';
import type { ParsedContent } from '../../types/parsedContent';

export class ContentStructureParser {
  private nodeIdCounter = 0;
  private turndownService?: any;

  constructor() {
    // Initialize turndown service if available
    try {
      // Dynamic import to handle environments where turndown might not be available
      import('turndown').then(TurndownService => {
        this.turndownService = new TurndownService.default({
          headingStyle: 'atx',
          bulletListMarker: '-',
          codeBlockStyle: 'fenced'
        });
      }).catch(() => {
        console.warn('TurndownService not available for content structure parsing');
      });
    } catch (error) {
      console.warn('TurndownService not available:', error);
    }
  }

  /**
   * Parse HTML content into a hierarchical content graph
   */
  parseFromHtml(html: string): ContentGraph {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    return this.parseFromElement(tempDiv);
  }

  /**
   * Parse from a DOM element
   */
  parseFromElement(element: Element): ContentGraph {
    const root: ContentNode = {
      id: this.generateId(),
      type: 'root',
      title: 'Document Root',
      content: '',
      children: [],
      order: 0
    };

    const nodes = new Map<string, ContentNode>();
    const flatNodes: ContentNode[] = [root];
    const headerLevels = new Map<number, ContentNode[]>();
    
    nodes.set(root.id, root);

    // Stack to keep track of current parent at each header level
    const headerStack: ContentNode[] = [root];
    let currentOrder = 1;

    // Get all child nodes and process them sequentially
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script, style, and other non-content elements
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = (node as Element).tagName?.toLowerCase();
            if (['script', 'style', 'noscript', 'meta', 'link'].includes(tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentContentBuffer: { text: string; html: string; elements: Element[] } = {
      text: '',
      html: '',
      elements: []
    };

    const flushContentBuffer = (parent: ContentNode) => {
      if (currentContentBuffer.text.trim() || currentContentBuffer.html.trim()) {
        const contentNode: ContentNode = {
          id: this.generateId(),
          type: 'content',
          content: currentContentBuffer.text.trim(),
          rawHtml: currentContentBuffer.html.trim(),
          markdown: this.turndownService ? this.turndownService.turndown(currentContentBuffer.html) : '',
          wordCount: currentContentBuffer.text.split(/\s+/).filter((w: string) => w.length > 0).length,
          children: [],
          parentId: parent.id,
          order: currentOrder++
        };

        parent.children.push(contentNode);
        nodes.set(contentNode.id, contentNode);
        flatNodes.push(contentNode);

        // Reset buffer
        currentContentBuffer = { text: '', html: '', elements: [] };
      }
    };

    let currentNode: Node | null;
    let hasProcessedAnyContent = false;

    while (currentNode = walker.nextNode()) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as Element;
        const tagName = element.tagName.toLowerCase();

        // Check if this is a header
        const headerMatch = tagName.match(/^h([1-6])$/);
        if (headerMatch) {
          const level = parseInt(headerMatch[1]);
          
          // Extract clean header text, removing any link functionality
          const headerText = this.extractCleanHeaderText(element);

          // Flush any accumulated content to the current parent
          const currentParent = headerStack[headerStack.length - 1];
          flushContentBuffer(currentParent);

          // Find the appropriate parent for this header level
          // Remove headers from stack that are at same or deeper level
          while (headerStack.length > 1) {
            const topHeader = headerStack[headerStack.length - 1];
            if (topHeader.type === 'root' || (topHeader.level && topHeader.level < level)) {
              break;
            }
            headerStack.pop();
          }

          const parent = headerStack[headerStack.length - 1];

          // Create clean HTML without links for rawHtml
          const cleanHtml = this.createCleanHeaderHtml(element, headerText, level);

          // Create header node
          const headerNode: ContentNode = {
            id: this.generateId(),
            type: 'header',
            level,
            title: headerText,
            content: headerText,
            rawHtml: cleanHtml,
            markdown: this.turndownService ? this.turndownService.turndown(cleanHtml) : `${'#'.repeat(level)} ${headerText}`,
            wordCount: headerText.split(/\s+/).filter((w: string) => w.length > 0).length,
            children: [],
            parentId: parent.id,
            order: currentOrder++
          };

          parent.children.push(headerNode);
          nodes.set(headerNode.id, headerNode);
          flatNodes.push(headerNode);

          // Add to header levels map
          if (!headerLevels.has(level)) {
            headerLevels.set(level, []);
          }
          headerLevels.get(level)!.push(headerNode);

          // Push this header onto the stack as potential parent for future content
          headerStack.push(headerNode);
          hasProcessedAnyContent = true;

          // Skip the header element's children since we've processed the header text
          walker.nextSibling();
          continue;
        } else {
          // For non-header elements, accumulate their content
          const elementText = this.extractTextFromElement(element);
          const elementHtml = element.outerHTML;

          if (elementText.trim()) {
            currentContentBuffer.text += (currentContentBuffer.text ? '\n' : '') + elementText;
            currentContentBuffer.html += (currentContentBuffer.html ? '\n' : '') + elementHtml;
            currentContentBuffer.elements.push(element);
            hasProcessedAnyContent = true;
          }
        }
      } else if (currentNode.nodeType === Node.TEXT_NODE) {
        const textContent = currentNode.textContent?.trim();
        if (textContent) {
          currentContentBuffer.text += (currentContentBuffer.text ? ' ' : '') + textContent;
          currentContentBuffer.html += textContent;
          hasProcessedAnyContent = true;
        }
      }
    }

    // Flush any remaining content buffer
    const finalParent = headerStack[headerStack.length - 1];
    flushContentBuffer(finalParent);

    // If we haven't processed any content but have HTML, try a different approach
    if (!hasProcessedAnyContent && element.textContent?.trim()) {
      console.log('parseFromElement: No structured content found, creating fallback content node');
      
      // Create a fallback content node with all the text content
      const fallbackContent: ContentNode = {
        id: this.generateId(),
        type: 'content',
        content: element.textContent.trim(),
        rawHtml: element.innerHTML,
        markdown: this.turndownService ? this.turndownService.turndown(element.innerHTML) : element.textContent.trim(),
        wordCount: element.textContent.trim().split(/\s+/).filter((w: string) => w.length > 0).length,
        children: [],
        parentId: root.id,
        order: currentOrder++
      };

      root.children.push(fallbackContent);
      nodes.set(fallbackContent.id, fallbackContent);
      flatNodes.push(fallbackContent);
    }

    // Calculate stats
    const stats = this.calculateStats(flatNodes, headerLevels);

    return {
      root,
      nodes,
      flatNodes,
      headerLevels,
      stats
    };
  }

  /**
   * Parse from markdown text (simplified approach)
   */
  parseFromMarkdown(markdown: string): ContentGraph {
    const lines = markdown.split('\n');
    const root: ContentNode = {
      id: this.generateId(),
      type: 'root',
      title: 'Document Root',
      content: '',
      children: [],
      order: 0
    };

    const nodes = new Map<string, ContentNode>();
    const flatNodes: ContentNode[] = [root];
    const headerLevels = new Map<number, ContentNode[]>();
    
    nodes.set(root.id, root);

    const headerStack: ContentNode[] = [root];
    let currentOrder = 1;
    let currentContentBuffer: string[] = [];

    const flushContentBuffer = (parent: ContentNode) => {
      if (currentContentBuffer.length > 0) {
        const content = currentContentBuffer.join('\n').trim();
        if (content) {
          const contentNode: ContentNode = {
            id: this.generateId(),
            type: 'content',
            content,
            markdown: content,
            wordCount: content.split(/\s+/).filter((w: string) => w.length > 0).length,
            children: [],
            parentId: parent.id,
            order: currentOrder++
          };

          parent.children.push(contentNode);
          nodes.set(contentNode.id, contentNode);
          flatNodes.push(contentNode);
        }
        currentContentBuffer = [];
      }
    };

    let hasProcessedAnyHeaders = false;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        const level = headerMatch[1].length;
        const headerText = headerMatch[2].trim();

        // Flush content buffer
        const currentParent = headerStack[headerStack.length - 1];
        flushContentBuffer(currentParent);

        // Find appropriate parent
        while (headerStack.length > 1) {
          const topHeader = headerStack[headerStack.length - 1];
          if (topHeader.type === 'root' || (topHeader.level && topHeader.level < level)) {
            break;
          }
          headerStack.pop();
        }

        const parent = headerStack[headerStack.length - 1];

        // Create header node
        const headerNode: ContentNode = {
          id: this.generateId(),
          type: 'header',
          level,
          title: headerText,
          content: headerText,
          markdown: line,
          wordCount: headerText.split(/\s+/).filter((w: string) => w.length > 0).length,
          children: [],
          parentId: parent.id,
          order: currentOrder++
        };

        parent.children.push(headerNode);
        nodes.set(headerNode.id, headerNode);
        flatNodes.push(headerNode);

        if (!headerLevels.has(level)) {
          headerLevels.set(level, []);
        }
        headerLevels.get(level)!.push(headerNode);

        headerStack.push(headerNode);
        hasProcessedAnyHeaders = true;
      } else if (line.trim()) {
        // Accumulate content
        currentContentBuffer.push(line);
      } else if (currentContentBuffer.length > 0) {
        // Empty line - add to buffer to preserve spacing
        currentContentBuffer.push('');
      }
    }

    // Flush final content buffer
    const finalParent = headerStack[headerStack.length - 1];
    flushContentBuffer(finalParent);

    // If we have no headers but have content, ensure we create at least one content node
    if (!hasProcessedAnyHeaders && markdown.trim() && root.children.length === 0) {
      console.log('parseFromMarkdown: No headers found, creating single content node');
      
      const singleContentNode: ContentNode = {
        id: this.generateId(),
        type: 'content',
        content: markdown.trim(),
        markdown: markdown.trim(),
        wordCount: markdown.trim().split(/\s+/).filter((w: string) => w.length > 0).length,
        children: [],
        parentId: root.id,
        order: currentOrder++
      };

      root.children.push(singleContentNode);
      nodes.set(singleContentNode.id, singleContentNode);
      flatNodes.push(singleContentNode);
    }

    const stats = this.calculateStats(flatNodes, headerLevels);

    return {
      root,
      nodes,
      flatNodes,
      headerLevels,
      stats
    };
  }

  private extractTextFromElement(element: Element): string {
    // For certain block-level elements, we want to preserve their structure
    const blockElements = ['p', 'div', 'section', 'article', 'aside', 'blockquote', 'pre', 'li', 'td', 'th'];
    const tagName = element.tagName.toLowerCase();
    
    // If this is a header element, skip it (it will be processed separately)
    if (/^h[1-6]$/.test(tagName)) {
      return '';
    }
    
    // Create a tree walker to extract text content while preserving some structure
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const elTagName = el.tagName.toLowerCase();
            
            // Skip script, style, and other non-content elements
            if (['script', 'style', 'noscript', 'meta', 'link'].includes(elTagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            
            // Skip nested headers (they'll be processed separately)
            if (/^h[1-6]$/.test(elTagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            
            return NodeFilter.FILTER_ACCEPT;
          }
          
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (!text) return NodeFilter.FILTER_REJECT;
            
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            
            const parentTagName = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript'].includes(parentTagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            
            return NodeFilter.FILTER_ACCEPT;
          }
          
          return NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    const textParts: string[] = [];
    let node;
    let lastWasBlockElement = false;
    
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          // Add some spacing logic for better text flow
          if (lastWasBlockElement && textParts.length > 0) {
            textParts.push('\n' + text);
          } else {
            textParts.push(text);
          }
          lastWasBlockElement = false;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const elTagName = el.tagName.toLowerCase();
        
        // Mark that we encountered a block element for spacing
        if (blockElements.includes(elTagName)) {
          lastWasBlockElement = true;
        }
        
        // For certain elements, we might want to add specific formatting
        if (elTagName === 'br') {
          textParts.push('\n');
        }
      }
    }
    
    return textParts.join(' ').replace(/\s+/g, ' ').replace(/\n\s+/g, '\n').trim();
  }

  private calculateStats(flatNodes: ContentNode[], headerLevels: Map<number, ContentNode[]>): ContentGraph['stats'] {
    const headerCount = flatNodes.filter(n => n.type === 'header').length;
    const contentSections = flatNodes.filter(n => n.type === 'content').length;
    const wordCount = flatNodes.reduce((sum, n) => sum + (n.wordCount || 0), 0);
    
    const maxDepth = Math.max(...Array.from(headerLevels.keys()), 0);

    return {
      totalNodes: flatNodes.length,
      headerCount,
      contentSections,
      maxDepth,
      wordCount
    };
  }

  private generateId(): string {
    return `node_${++this.nodeIdCounter}_${Date.now()}`;
  }

  /**
   * Extract clean header text, removing any link functionality while preserving text content
   */
  private extractCleanHeaderText(element: Element): string {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as Element;
    
    // Find all links within the cloned header and replace them with their text content
    const links = clone.querySelectorAll('a');
    links.forEach(link => {
      const textNode = document.createTextNode(link.textContent || '');
      link.parentNode?.replaceChild(textNode, link);
    });
    
    // Return the clean text content
    return clone.textContent?.trim() || '';
  }

  /**
   * Create clean HTML for header without links
   */
  private createCleanHeaderHtml(element: Element, cleanText: string, level: number): string {
    // Create a clean header element with just the text content
    return `<h${level}>${cleanText}</h${level}>`;
  }
}

// Create a singleton instance
const contentStructureParser = new ContentStructureParser();

/**
 * Parse HTML content into a structured format for ContentStructure component
 */
export function parseContentFromHtml(html: string): ParsedContent {
  if (!html || html.trim().length === 0) {
    return {
      contentStructure: null,
      error: 'No HTML content provided'
    };
  }

  try {
    console.log('parseContentFromHtml: Parsing HTML content...');
    const graph = contentStructureParser.parseFromHtml(html);
    
    console.log('parseContentFromHtml: Parse result:', {
      totalNodes: graph.stats.totalNodes,
      headerCount: graph.stats.headerCount,
      contentSections: graph.stats.contentSections,
      maxDepth: graph.stats.maxDepth
    });

    // Convert ContentGraph to ParsedContent format
    const contentStructure = {
      root: {
        children: graph.root.children
      },
      stats: {
        totalNodes: graph.stats.totalNodes,
        headerCount: graph.stats.headerCount,
        contentSections: graph.stats.contentSections,
        maxDepth: graph.stats.maxDepth
      }
    };

    return {
      contentStructure,
      error: null
    };

  } catch (error) {
    console.error('parseContentFromHtml: Error parsing HTML:', error);
    return {
      contentStructure: null,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Parse content structure from markdown text
 */
export function parseContentFromMarkdown(markdown: string): ParsedContent {
  if (!markdown || markdown.trim().length === 0) {
    return {
      contentStructure: null,
      error: 'No markdown content provided'
    };
  }

  try {
    console.log('parseContentFromMarkdown: Parsing markdown content...');
    const graph = contentStructureParser.parseFromMarkdown(markdown);
    
    console.log('parseContentFromMarkdown: Parse result:', {
      totalNodes: graph.stats.totalNodes,
      headerCount: graph.stats.headerCount,
      contentSections: graph.stats.contentSections,
      maxDepth: graph.stats.maxDepth
    });

    // Convert ContentGraph to ParsedContent format
    const contentStructure = {
      root: {
        children: graph.root.children
      },
      stats: {
        totalNodes: graph.stats.totalNodes,
        headerCount: graph.stats.headerCount,
        contentSections: graph.stats.contentSections,
        maxDepth: graph.stats.maxDepth
      }
    };

    return {
      contentStructure,
      error: null
    };

  } catch (error) {
    console.error('parseContentFromMarkdown: Error parsing markdown:', error);
    return {
      contentStructure: null,
      error: error instanceof Error ? error.message : 'Unknown markdown parsing error'
    };
  }
}

/**
 * Enhanced parser that tries HTML first, then falls back to markdown
 */
export function parseContent(content: { html?: string; text?: string; markdown?: string }): ParsedContent {
  console.log('parseContent: Starting content parsing...', {
    hasHtml: !!content.html,
    hasMarkdown: !!content.markdown,
    hasText: !!content.text,
    htmlLength: content.html?.length || 0,
    markdownLength: content.markdown?.length || 0,
    textLength: content.text?.length || 0
  });

  let lastError: string | null = null;
  
  // Try HTML first if available
  if (content.html && content.html.trim().length > 0) {
    console.log('parseContent: Attempting HTML parsing...');
    const htmlResult = parseContentFromHtml(content.html);
    console.log('parseContent: HTML result:', {
      success: !!htmlResult.contentStructure,
      error: htmlResult.error,
      nodeCount: htmlResult.contentStructure?.stats?.totalNodes || 0,
      headerCount: htmlResult.contentStructure?.stats?.headerCount || 0,
      contentSections: htmlResult.contentStructure?.stats?.contentSections || 0
    });
    if (htmlResult.contentStructure) {
      return htmlResult;
    }
    lastError = htmlResult.error || 'HTML parsing failed';
  }

  // Fall back to markdown if available
  if (content.markdown && content.markdown.trim().length > 0) {
    console.log('parseContent: Attempting markdown parsing...');
    const markdownResult = parseContentFromMarkdown(content.markdown);
    console.log('parseContent: Markdown result:', {
      success: !!markdownResult.contentStructure,
      error: markdownResult.error,
      nodeCount: markdownResult.contentStructure?.stats?.totalNodes || 0,
      headerCount: markdownResult.contentStructure?.stats?.headerCount || 0,
      contentSections: markdownResult.contentStructure?.stats?.contentSections || 0
    });
    if (markdownResult.contentStructure) {
      return markdownResult;
    }
    lastError = markdownResult.error || 'Markdown parsing failed';
  }

  // Last resort: try to parse text as markdown
  if (content.text && content.text.trim().length > 0) {
    console.log('parseContent: Attempting text-as-markdown parsing...');
    const textResult = parseContentFromMarkdown(content.text);
    console.log('parseContent: Text-as-markdown result:', {
      success: !!textResult.contentStructure,
      error: textResult.error,
      nodeCount: textResult.contentStructure?.stats?.totalNodes || 0,
      headerCount: textResult.contentStructure?.stats?.headerCount || 0,
      contentSections: textResult.contentStructure?.stats?.contentSections || 0
    });
    if (textResult.contentStructure) {
      return textResult;
    }
    lastError = textResult.error || 'Text parsing failed';
  }

  console.log('parseContent: All parsing attempts failed:', { lastError });
  return {
    contentStructure: null,
    error: lastError || 'No parseable content found'
  };
}
