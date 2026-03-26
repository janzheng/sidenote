import { extractMetadata } from './extractMetadata.svelte';
import { normalizeUrl as cleanUrl } from '../../lib/utils/contentId';
import { contentDataController } from '../../lib/services/dataController.svelte';
import { PDFExtractionService } from '../../lib/services/pdfExtractionService.svelte';

import TurndownService from 'turndown';
import { strikethrough, taskListItems } from 'turndown-plugin-gfm';

export interface ContentExtractionResult {
  success: boolean;
  content?: {
    url: string;
    text: string;
    html: string;
    title: string;
    metadata: any;
    wordCount: number;
    markdown?: string;
    extractedAt?: number;
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

  // Add selective GitHub Flavored Markdown support (exclude tables to avoid parentNode issues)
  try {
    turndownService.use(strikethrough);
    turndownService.use(taskListItems);
  } catch (e) {
    console.warn('Turndown GFM selective plugins failed to load:', e);
  }

  // Custom rules for better content extraction
  turndownService.addRule('removeScript', {
    filter: ['script', 'style', 'noscript'],
    replacement: () => ''
  });

  turndownService.addRule('removeNav', {
    filter: ['nav', 'header', 'footer', 'aside'],
    replacement: () => ''
  });

  // Custom table handling (GFM tables plugin excluded due to parentNode issues)
  turndownService.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content: string) => {
      // Collapse whitespace and trim; replace pipes to avoid breaking table syntax
      return ' ' + content.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() + ' |';
    }
  });

  turndownService.addRule('tableRow', {
    filter: 'tr',
    replacement: (content: string, node: any) => {
      let row = '|' + content + '\n';
      // If this is the first row inside a thead, add separator row after it
      if (node.parentNode && node.parentNode.nodeName === 'THEAD') {
        const cellCount = node.querySelectorAll('th, td').length;
        row += '|' + ' --- |'.repeat(cellCount) + '\n';
      }
      return row;
    }
  });

  turndownService.addRule('table', {
    filter: 'table',
    replacement: (content: string, node: any) => {
      // If the table has no thead, add a separator after the first row
      const thead = node.querySelector('thead');
      if (!thead) {
        const firstRow = node.querySelector('tr');
        if (firstRow) {
          const cellCount = firstRow.querySelectorAll('th, td').length;
          const lines = content.trim().split('\n');
          if (lines.length > 0) {
            const separator = '|' + ' --- |'.repeat(cellCount);
            lines.splice(1, 0, separator);
            return '\n\n' + lines.join('\n') + '\n\n';
          }
        }
      }
      return '\n\n' + content.trim() + '\n\n';
    }
  });

  turndownService.addRule('tableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: (content: string) => {
      return content;
    }
  });

  // Custom nested list handling for consistent 2-space indentation per nesting level
  turndownService.addRule('listItem', {
    filter: 'li',
    replacement: (content: string, node: any, options: any) => {
      content = content
        .replace(/^\n+/, '')  // remove leading newlines
        .replace(/\n+$/, '\n')  // normalize trailing newlines
        .replace(/\n/gm, '\n  ');  // indent continuation lines by 2 spaces

      // Calculate nesting depth by counting ancestor <ul>/<ol> elements
      let depth = 0;
      let parent = node.parentNode;
      while (parent) {
        if (parent.nodeName === 'UL' || parent.nodeName === 'OL') {
          depth++;
        }
        parent = parent.parentNode;
      }
      // depth >= 1 since the li is always inside at least one list
      // Indent = 2 spaces per level beyond the first
      const indent = '  '.repeat(Math.max(0, depth - 1));

      const bulletMarker = node.parentNode && node.parentNode.nodeName === 'OL'
        ? (Array.prototype.indexOf.call(node.parentNode.children, node) + 1) + '. '
        : options.bulletListMarker + ' ';

      return indent + bulletMarker + content.trim() + '\n';
    }
  });

  // Convert YouTube/Vimeo/common embed iframes into markdown links
  turndownService.addRule('embedIframe', {
    filter: (node: any) => {
      if (node.nodeName !== 'IFRAME') return false;
      const src = node.getAttribute('src') || '';
      return /youtube\.com\/embed/i.test(src) ||
        /player\.vimeo\.com/i.test(src) ||
        /dailymotion\.com\/embed/i.test(src) ||
        /players\.brightcove\.net/i.test(src);
    },
    replacement: (content: string, node: any) => {
      const src = node.getAttribute('src') || '';
      const title = node.getAttribute('title') || 'Video';
      return `[Embedded video: ${title}](${src})`;
    }
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
    const currentUrl = window.location.href;
    const cleanedUrl = cleanUrl(currentUrl);
    
    console.log('📄 Extracting content for:', currentUrl);
    if (currentUrl !== cleanedUrl) {
      console.log('📄 Cleaned URL:', cleanedUrl);
    }
    
    // Check if this is a PDF page and handle accordingly
    if (PDFExtractionService.isCurrentPagePDF()) {
      console.log('📄 PDF page detected, using PDF extraction service');
      
      const pdfResult = await PDFExtractionService.extractPDF(currentUrl, document.title);
      
      if (pdfResult.success && pdfResult.content) {
        console.log('✅ PDF extraction successful');
        
        // Generate citations for PDF content
        let saveData: any = { content: pdfResult.content };
        
        try {
          const { CitationService } = await import('../../lib/services/citationService.svelte');
          const citationResult = await CitationService.generateCitations(pdfResult.content.metadata, cleanedUrl);
          
          if (citationResult.success && citationResult.citations) {
            console.log('✅ Citations generated successfully for PDF');
            saveData.analysis = {
              summary: null,
              citations: citationResult.citations,
              researchPaper: null,
              contentStructure: null
            };
          }
        } catch (citationError) {
          console.warn('⚠️ Citation service error for PDF:', citationError);
        }
        
        // Save to data controller
        const saveSuccess = await contentDataController.saveData(cleanedUrl, saveData);
        
        if (!saveSuccess) {
          console.warn('⚠️ Failed to save PDF content to data controller, but extraction succeeded');
        }
        
        return { 
          success: true, 
          content: {
            url: pdfResult.content.url,
            text: pdfResult.content.text,
            html: pdfResult.content.html,
            title: pdfResult.content.title,
            metadata: pdfResult.content.metadata,
            wordCount: pdfResult.content.wordCount
          }
        };
      } else {
        console.warn('⚠️ PDF extraction failed, falling back to regular extraction:', pdfResult.error);
        // Fall through to regular extraction
      }
    }
    
    // Check for embedded PDF
    if (PDFExtractionService.hasEmbeddedPDF()) {
      console.log('📄 Embedded PDF detected');
      const embeddedPDFUrl = PDFExtractionService.getEmbeddedPDFUrl();
      
      if (embeddedPDFUrl) {
        console.log('📄 Attempting to extract embedded PDF:', embeddedPDFUrl);
        
        const pdfResult = await PDFExtractionService.extractPDF(embeddedPDFUrl, document.title);
        
        if (pdfResult.success && pdfResult.content) {
          console.log('✅ Embedded PDF extraction successful');
          
          // Generate citations for embedded PDF content
          let saveData: any = { content: pdfResult.content };
          
          try {
            const { CitationService } = await import('../../lib/services/citationService.svelte');
            const citationResult = await CitationService.generateCitations(pdfResult.content.metadata, cleanedUrl);
            
            if (citationResult.success && citationResult.citations) {
              console.log('✅ Citations generated successfully for embedded PDF');
              saveData.analysis = {
                summary: null,
                citations: citationResult.citations,
                researchPaper: null,
                contentStructure: null
              };
            }
          } catch (citationError) {
            console.warn('⚠️ Citation service error for embedded PDF:', citationError);
          }
          
          // Save to data controller
          const saveSuccess = await contentDataController.saveData(cleanedUrl, saveData);
          
          if (!saveSuccess) {
            console.warn('⚠️ Failed to save embedded PDF content to data controller, but extraction succeeded');
          }
          
          return { 
            success: true, 
            content: {
              url: pdfResult.content.url,
              text: pdfResult.content.text,
              html: pdfResult.content.html,
              title: pdfResult.content.title,
              metadata: pdfResult.content.metadata,
              wordCount: pdfResult.content.wordCount
            }
          };
        } else {
          console.warn('⚠️ Embedded PDF extraction failed, falling back to regular extraction:', pdfResult.error);
          // Fall through to regular extraction
        }
      }
    }
    
    // Create Turndown service
    const turndownService = createTurndownService();
    let markdown = '';
    try {
      // Prefer body HTML to avoid full-document edge cases (head/html nodes)
      markdown = turndownService.turndown(document.body.innerHTML);
    } catch (mdErr) {
      console.warn('Turndown failed, falling back to plain text:', mdErr);
      markdown = document.body.innerText || '';
    }
    
    // Calculate word count
    const wordCount = document.body.innerText.split(/\s+/).filter(word => word.length > 0).length;

    // Extract comprehensive metadata
    const metadata = extractMetadata();
    
    // Extract all content
    const content = {
      url: cleanedUrl, // Use cleaned URL
      text: document.body.innerText,
      html: document.documentElement.outerHTML,
      title: document.title,
      metadata: metadata,
      markdown: markdown,
      wordCount: wordCount,
      extractedAt: Date.now()
    };
    
    // Prepare the base content data structure
    const baseContentData = {
      url: cleanedUrl,
      text: content.text,
      html: content.html,
      title: content.title,
      metadata: metadata,
      markdown: markdown,
      wordCount: wordCount,
      extractedAt: Date.now()
    };

    // Generate citations and prepare save data
    console.log('📚 Generating citations from extracted metadata...');
    let saveData: any = { content: baseContentData };
    
    try {
      const { CitationService } = await import('../../lib/services/citationService.svelte');
      const citationResult = await CitationService.generateCitations(metadata, cleanedUrl);
      
      if (citationResult.success && citationResult.citations) {
        console.log('✅ Citations generated successfully');
        console.log('📋 Citation formats available:', Object.keys(citationResult.citations));
        
        // Add citations to the save data
        saveData.analysis = {
          summary: null,
          citations: citationResult.citations,
          researchPaper: null,
          contentStructure: null
        };
      } else {
        console.warn('⚠️ Citation generation failed:', citationResult.error);
      }
    } catch (citationError) {
      console.warn('⚠️ Citation service error:', citationError);
    }
    
    // Save to data controller - this will merge with existing data preserving statuses
    const saveSuccess = await contentDataController.saveData(cleanedUrl, saveData);
    
    if (!saveSuccess) {
      console.warn('⚠️ Failed to save content to data controller, but extraction succeeded');
    }
    
    console.log('📄 Content extracted:', {
      url: cleanedUrl,
      textLength: content.text.length,
      htmlLength: content.html.length,
      markdownLength: markdown.length,
      title: content.title,
      wordCount: wordCount,
      hasSchemaData: !!metadata.schemaData,
      hasCitations: !!metadata.citations,
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