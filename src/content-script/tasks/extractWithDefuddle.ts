import { normalizeUrl as cleanUrl } from '../../lib/utils/contentId';
import { extractMetadata } from './extractMetadata.svelte';
import type { ContentExtractionResult } from './extractContent.svelte';

// Defuddle is loaded as a separate UMD script (defuddle.js) via manifest.json
// and exposed as a global `Defuddle` to avoid TDZ errors when bundled with IIFE
declare const Defuddle: any;

/**
 * Extract content using defuddle - article isolation + site-specific extractors
 * Falls back to null if defuddle fails or produces insufficient content
 */
export async function extractWithDefuddle(): Promise<ContentExtractionResult | null> {
  try {
    if (typeof Defuddle === 'undefined') {
      console.warn('🧹 Defuddle not available (global not loaded)');
      return null;
    }

    const currentUrl = window.location.href;

    // Skip defuddle on Google Maps — it has a dedicated extractor and
    // defuddle's DOM parsing conflicts with Maps' heavy dynamic rendering
    if (currentUrl.includes('google.com/maps') || currentUrl.includes('maps.google.com')) {
      console.log('🧹 Skipping defuddle on Google Maps (dedicated extractor available)');
      return null;
    }
    const cleanedUrl = cleanUrl(currentUrl);

    console.log('🧹 Attempting defuddle extraction for:', currentUrl);

    const defuddleInstance = new Defuddle(document, {
      markdown: true,
      url: currentUrl,
      useAsync: true,
      includeReplies: 'extractors',
    });

    // Try async first (enables Reddit old.reddit.com fallback, YouTube transcripts, etc.)
    // If async fetch fails (e.g. CORS in content script), fall back to sync parse
    let result: any;
    try {
      result = await defuddleInstance.parseAsync();
    } catch (asyncError) {
      console.warn('🧹 Defuddle async extraction failed, trying sync:', asyncError);
      result = defuddleInstance.parse();
    }

    // Check if defuddle produced meaningful content
    if (!result.content || result.wordCount < 50) {
      console.log('🧹 Defuddle produced insufficient content (wordCount:', result.wordCount, '), falling back');
      return null;
    }

    console.log('🧹 Defuddle extraction successful:', {
      extractorType: result.extractorType || 'generic',
      wordCount: result.wordCount,
      hasMarkdown: !!result.contentMarkdown,
      title: result.title,
      parseTime: result.parseTime,
    });

    // Get markdown - prefer defuddle's markdown, fall back to content HTML
    const markdown = result.contentMarkdown || result.content || '';

    // Extract metadata from our existing extractor (for citation metadata, academic data, etc.)
    const ourMetadata = extractMetadata();

    // Merge defuddle metadata into our metadata structure
    const mergedMetadata = {
      ...ourMetadata,
      ...(result.title && { title: result.title }),
      ...(result.author && { author: result.author }),
      ...(result.published && { published: result.published }),
      ...(result.description && { description: result.description }),
      ...(result.site && { siteName: result.site }),
      ...(result.language && { language: result.language }),
      ...(result.image && { ogImage: result.image }),
      ...(result.favicon && { favicon: result.favicon }),
      ...(result.schemaOrgData && { schemaData: result.schemaOrgData }),
    };

    const content = {
      url: cleanedUrl,
      text: document.body.innerText,
      html: document.documentElement.outerHTML,
      cleanHtml: result.content,
      title: result.title || document.title,
      metadata: mergedMetadata,
      markdown: markdown,
      wordCount: result.wordCount || document.body.innerText.split(/\s+/).filter((w: string) => w.length > 0).length,
      extractedAt: Date.now(),
      extractionMethod: 'defuddle' as const,
      defuddleExtractorType: result.extractorType,
      defuddleVariables: result.variables,
    };

    return { success: true, content };
  } catch (error) {
    console.warn('🧹 Defuddle extraction failed, will fall back:', error);
    return null;
  }
}
