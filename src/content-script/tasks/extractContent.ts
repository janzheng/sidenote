import { extractMetadata } from './extractMetadata';
import { contentDataController } from '../../lib/services/dataController';

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface ContentExtractionResult {
  success: boolean;
  content?: {
    url: string;
    text: string;
    html: string;
    title: string;
    metadata: any;
    wordCount: number;
  };
  error?: string;
}

/**
 * Configure and create a Turndown service instance
 */
function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    preformattedCode: false
  });

  // Add GitHub Flavored Markdown support
  turndownService.use(gfm);

  // Custom rules for better content extraction
  turndownService.addRule('removeScript', {
    filter: ['script', 'style', 'noscript'],
    replacement: () => ''
  });

  turndownService.addRule('removeNav', {
    filter: ['nav', 'header', 'footer', 'aside'],
    replacement: () => ''
  });

  // Keep images but make them more readable
  turndownService.addRule('images', {
    filter: 'img',
    replacement: (content, node) => {
      const alt = (node as HTMLImageElement).alt || '';
      const src = (node as HTMLImageElement).src || '';
      const title = (node as HTMLImageElement).title || '';
      
      if (!src) return '';
      
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    }
  });

  return turndownService;
}

/**
 * Extract content from the current page and save it to the data controller
 */
export async function extractContent(): Promise<ContentExtractionResult> {
  try {
    console.log('📄 Extracting content for:', window.location.href);
    
    // Create Turndown service
    const turndownService = createTurndownService();
    const markdown = turndownService.turndown(document.documentElement.outerHTML);
    // Calculate word count
    const wordCount = document.body.innerText.split(/\s+/).filter(word => word.length > 0).length;

    
    // Extract all content
    const content = {
      url: window.location.href,
      text: document.body.innerText,
      html: document.documentElement.outerHTML,
      title: document.title,
      metadata: extractMetadata(),
      markdown: markdown,
      wordCount: wordCount,
      extractedAt: Date.now()
    };
    
    // Save to data controller - this will merge with existing data preserving statuses
    const saveSuccess = await contentDataController.saveData(content.url, {
      content: {
        url: content.url,
        text: content.text,
        html: content.html,
        title: content.title,
        metadata: content.metadata,
        markdown: markdown,
        wordCount: wordCount,
        extractedAt: Date.now()
      }
    });
    
    if (!saveSuccess) {
      console.warn('⚠️ Failed to save content to data controller, but extraction succeeded');
    }
    
    console.log('📄 Content extracted:', {
      url: content.url,
      textLength: content.text.length,
      htmlLength: content.html.length,
      markdownLength: markdown.length,
      title: content.title,
      wordCount: wordCount,
      saved: saveSuccess
    });
    
    return { success: true, content };
  } catch (error) {
    console.error('📄 Content extraction failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Content extraction failed' 
    };
  }
} 