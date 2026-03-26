/**
 * Shared helpers for social media content extraction (Twitter + LinkedIn)
 */

/**
 * Create a hash of text content for deduplication
 */
export function createTextHash(text: string): string {
  let hash = 0;
  const cleanText = text.replace(/\s+/g, ' ').trim();

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
}

/**
 * Generate a unique element ID from position + content hash
 */
export function generateElementId(element: Element, prefix: string): string {
  const existingId = element.id;
  if (existingId) return existingId;

  const rect = element.getBoundingClientRect();
  const textContent = element.textContent?.substring(0, 50) || '';
  const textHash = createTextHash(textContent);

  return `${prefix}_${rect.top}_${rect.left}_${textHash}`;
}

/**
 * Parse engagement count from text like "1.2K", "3M", "456"
 */
export function parseEngagementCount(text: string): number {
  if (!text) return 0;

  const match = text.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();

  switch (suffix) {
    case 'K': return Math.round(num * 1000);
    case 'M': return Math.round(num * 1000000);
    case 'B': return Math.round(num * 1000000000);
    default: return Math.round(num);
  }
}

/**
 * Extract images from an element, filtering out profile pics/icons
 */
export interface ImageExtractionOptions {
  excludePatterns: string[];   // URL substrings to exclude (e.g. 'profile_images')
  excludeAltPatterns: string[]; // Alt text substrings to exclude (e.g. 'avatar')
  minWidth?: number;           // Minimum naturalWidth to include
}

export function extractImagesFromElement(element: Element, options: ImageExtractionOptions): { url: string; alt: string }[] {
  const images: { url: string; alt: string }[] = [];
  const imageElements = element.querySelectorAll('img[src]');

  imageElements.forEach(img => {
    if (img instanceof HTMLImageElement) {
      const src = img.src;
      const alt = img.alt || '';

      if (!src) return;
      if (options.excludePatterns.some(p => src.includes(p))) return;
      if (options.excludeAltPatterns.some(p => alt.includes(p))) return;
      if (options.minWidth && img.naturalWidth < options.minWidth) return;

      images.push({ url: src, alt });
    }
  });

  return images;
}

/**
 * Extract hashtags from text
 */
export function extractHashtagsFromText(text: string): string[] {
  return text.match(/#\w+/g) || [];
}

/**
 * Extract mentions from text (supports hyphens for LinkedIn-style usernames)
 */
export function extractMentionsFromText(text: string): string[] {
  return text.match(/@[\w-]+/g) || [];
}
