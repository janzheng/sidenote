import type { FontInfo, ImageInfo, SvgInfo, PageAssets, PageAssetsExtractionResult } from '../../types/pageAssets';

// Site-specific extractor interface for extensibility
export interface SiteExtractor {
  domain: string;
  extractFonts?(doc: Document): FontInfo[];
  extractImages?(doc: Document): ImageInfo[];
  extractSvgs?(doc: Document): SvgInfo[];
}

// Base asset extractor
export class PageAssetsExtractor {
  private siteExtractors: Map<string, SiteExtractor> = new Map();
  private baseUrl?: string;

  constructor() {
    // Register default site extractors
    this.registerSiteExtractor({
      domain: 'arxiv.org',
      extractImages: this.extractArxivImages.bind(this)
    });
    
    this.registerSiteExtractor({
      domain: 'pubmed.ncbi.nlm.nih.gov',
      extractImages: this.extractPubmedImages.bind(this)
    });
  }

  registerSiteExtractor(extractor: SiteExtractor) {
    this.siteExtractors.set(extractor.domain, extractor);
  }

  async extractAssets(html: string, url?: string): Promise<PageAssets> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Set the base URL for resolving relative URLs
    this.baseUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    
    // Get site-specific extractor if available
    const domain = url ? new URL(url).hostname : '';
    const siteExtractor = this.siteExtractors.get(domain);

    // Extract assets using base extractors and site-specific ones
    const fonts = [
      ...(await this.extractFonts(doc, url)),
      ...(siteExtractor?.extractFonts?.(doc) || [])
    ];
    
    const images = [
      ...(await this.extractImages(doc)),
      ...(siteExtractor?.extractImages?.(doc) || [])
    ];
    
    const svgs = [
      ...this.extractSvgs(doc),
      ...(siteExtractor?.extractSvgs?.(doc) || [])
    ];

    // Remove duplicates and generate stats
    const uniqueFonts = this.deduplicateFonts(fonts);
    const uniqueImages = this.deduplicateImages(images);
    const uniqueSvgs = this.deduplicateSvgs(svgs);

    return {
      fonts: uniqueFonts,
      images: uniqueImages,
      svgs: uniqueSvgs,
      stats: this.generateStats(uniqueFonts, uniqueImages, uniqueSvgs)
    };
  }

  private async extractFonts(doc: Document, url?: string): Promise<FontInfo[]> {
    const fonts: FontInfo[] = [];
    const fontFamilies = new Set<string>();
    const elements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body'];
    
    elements.forEach(tag => {
      const el = doc.querySelector(tag);
      if (el) {
        // Extract from inline styles as fallback
        const inlineStyle = el.getAttribute('style') || '';
        const fontFamilyMatch = inlineStyle.match(/font-family\s*:\s*([^;]+)/i);
        if (fontFamilyMatch) {
          const fontFamily = fontFamilyMatch[1].trim().replace(/['"]/g, '');
          if (fontFamily && !fontFamilies.has(fontFamily)) {
            fonts.push({
              id: `font-${tag}`,
              family: fontFamily,
              element: tag
            });
            fontFamilies.add(fontFamily);
          }
        }
      }
    });

    return fonts;
  }

  private async extractImages(doc: Document): Promise<ImageInfo[]> {
    const images: ImageInfo[] = [];

    // Extract from img elements
    const imgElements = doc.querySelectorAll('img');
    imgElements.forEach((img, index) => {
      // Use getAttribute to get the original src value, not the resolved one
      const originalSrc = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      
      if (originalSrc && originalSrc.trim() !== '') {
        let finalSrc = originalSrc;
        
        // If it's not already a full URL, make it one
        if (!originalSrc.startsWith('http://') && !originalSrc.startsWith('https://') && !originalSrc.startsWith('data:')) {
          if (this.baseUrl) {
            try {
              finalSrc = new URL(originalSrc, this.baseUrl).href;
            } catch (error) {
              console.warn('Failed to resolve image URL:', originalSrc);
              finalSrc = originalSrc;
            }
          }
        }
        
        const figure = img.closest('figure');
        const figcaption = figure?.querySelector('figcaption');
        
        images.push({
          id: `img-${index}`,
          src: finalSrc,
          filename: originalSrc.split('/').pop() || originalSrc,
          alt: img.getAttribute('alt') || '',
          title: img.getAttribute('title') || undefined,
          caption: figcaption?.textContent?.trim() || undefined,
          width: img.naturalWidth || undefined,
          height: img.naturalHeight || undefined,
          format: this.getImageFormat(finalSrc),
          context: this.getImageContext(img),
          figureContext: figure ? {
            figcaption: figcaption?.textContent?.trim(),
            figureId: figure.id || undefined
          } : undefined
        });
      }
    });

    // Extract background images from elements with style attributes
    const elementsWithBg = doc.querySelectorAll('[style*="background"]');
    elementsWithBg.forEach((element, index) => {
      const style = element.getAttribute('style') || '';
      const originalBgImage = this.extractBackgroundImage(style);
      if (originalBgImage) {
        let finalSrc = originalBgImage;
        
        // If it's not already a full URL, make it one
        if (!originalBgImage.startsWith('http://') && !originalBgImage.startsWith('https://') && !originalBgImage.startsWith('data:')) {
          if (this.baseUrl) {
            try {
              finalSrc = new URL(originalBgImage, this.baseUrl).href;
            } catch (error) {
              console.warn('Failed to resolve background image URL:', originalBgImage);
              finalSrc = originalBgImage;
            }
          }
        }
        
        images.push({
          id: `bg-${index}`,
          src: finalSrc,
          filename: originalBgImage.split('/').pop() || originalBgImage,
          alt: `Background image ${index + 1}`,
          format: this.getImageFormat(finalSrc),
          context: 'background'
        });
      }
    });

    return images;
  }

  private extractSvgs(doc: Document): SvgInfo[] {
    const svgs: SvgInfo[] = [];

    const svgElements = doc.querySelectorAll('svg');
    svgElements.forEach((svg, index) => {
      const title = svg.querySelector('title')?.textContent?.trim();
      const desc = svg.querySelector('desc')?.textContent?.trim();
      
      svgs.push({
        id: `svg-${index}`,
        code: svg.outerHTML,
        title: title || undefined,
        description: desc || undefined,
        viewBox: svg.getAttribute('viewBox') || undefined,
        width: svg.getAttribute('width') || undefined,
        height: svg.getAttribute('height') || undefined,
        classes: svg.className ? Array.from(svg.classList) : undefined,
        context: this.getSvgContext(svg)
      });
    });

    return svgs;
  }

  private extractArxivImages(doc: Document): ImageInfo[] {
    // ArXiv-specific image extraction logic can be added here
    return [];
  }

  private extractPubmedImages(doc: Document): ImageInfo[] {
    // PubMed-specific image extraction logic can be added here
    return [];
  }

  private getImageFormat(src: string): string {
    const extension = src.split('.').pop()?.toLowerCase();
    const formats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
    return formats.includes(extension || '') ? extension! : 'unknown';
  }

  private getImageContext(img: HTMLImageElement): ImageInfo['context'] {
    if (img.closest('figure')) return 'figure';
    if (img.src.includes('icon') || img.className.includes('icon')) return 'icon';
    if (img.src.includes('logo') || img.className.includes('logo')) return 'logo';
    return 'content';
  }

  private getSvgContext(svg: SVGElement): SvgInfo['context'] {
    if (svg.className.baseVal.includes('icon')) return 'icon';
    if (svg.closest('figure')) return 'illustration';
    if (svg.parentElement?.tagName === 'BODY') return 'background';
    return 'inline';
  }

  private extractBackgroundImage(style: string): string | null {
    const match = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/);
    return match ? match[1] : null;
  }

  private deduplicateFonts(fonts: FontInfo[]): FontInfo[] {
    const seen = new Set<string>();
    return fonts.filter(font => {
      const key = `${font.family}-${font.element}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateImages(images: ImageInfo[]): ImageInfo[] {
    const seen = new Set<string>();
    return images.filter(image => {
      if (seen.has(image.src)) return false;
      seen.add(image.src);
      return true;
    });
  }

  private deduplicateSvgs(svgs: SvgInfo[]): SvgInfo[] {
    const seen = new Set<string>();
    return svgs.filter(svg => {
      const hash = this.simpleHash(svg.code);
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private generateStats(fonts: FontInfo[], images: ImageInfo[], svgs: SvgInfo[]) {
    const imageFormats: Record<string, number> = {};
    const svgContexts: Record<string, number> = {};

    images.forEach(img => {
      imageFormats[img.format || 'unknown'] = (imageFormats[img.format || 'unknown'] || 0) + 1;
    });

    svgs.forEach(svg => {
      svgContexts[svg.context] = (svgContexts[svg.context] || 0) + 1;
    });

    return {
      totalFonts: fonts.length,
      totalImages: images.length,
      totalSvgs: svgs.length,
      uniqueFontFamilies: new Set(fonts.map(f => f.family)).size,
      imageFormats,
      svgContexts
    };
  }
}

// Service class for handling page assets extraction
export class PageAssetsService {
  private static extractor = new PageAssetsExtractor();

  /**
   * Extract page assets from HTML content
   */
  static async extractPageAssets(html: string, url: string): Promise<PageAssetsExtractionResult> {
    try {
      console.log('🎨 Starting page assets extraction for:', url);
      
      const assets = await this.extractor.extractAssets(html, url);
      
      console.log('✅ Page assets extracted:', {
        fonts: assets.fonts.length,
        images: assets.images.length,
        svgs: assets.svgs.length,
        stats: assets.stats
      });
      
      return {
        success: true,
        assets
      };
    } catch (error) {
      console.error('❌ Page assets extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Page assets extraction failed'
      };
    }
  }
}

// Export a singleton instance
export const pageAssetsExtractor = new PageAssetsExtractor(); 