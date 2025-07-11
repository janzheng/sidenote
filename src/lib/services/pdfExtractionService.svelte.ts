import type { TabData } from '../../types/tabData';
import type { PageMetadata } from '../../types/pageMetadata';
import { contentDataController } from './dataController.svelte';

export interface PDFExtractionResult {
  success: boolean;
  content?: {
    url: string;
    text: string;
    html: string;
    title: string;
    metadata: PageMetadata;
    wordCount: number;
    markdown: string;
    extractedAt: number;
  };
  error?: string;
  extractionMethod?: string;
}

export interface PDFExtractionStrategy {
  name: string;
  priority: number;
  canHandle: (url: string) => boolean;
  extract: (url: string, title?: string) => Promise<PDFExtractionResult>;
}

/**
 * PDF Extraction Service
 * Provides multiple fallback strategies for PDF content extraction
 */
export class PDFExtractionService {
  private static strategies: PDFExtractionStrategy[] = [];
  private static isInitialized = false;

  /**
   * Initialize PDF extraction strategies
   */
  private static async initializeStrategies() {
    if (this.isInitialized) return;

    // Strategy 1: Chrome Extension PDF.js (highest priority)
    this.strategies.push({
      name: 'chrome-extension-pdfjs',
      priority: 1,
      canHandle: (url: string) => this.isPDFUrl(url),
      extract: this.extractWithChromeExtensionPDFJS.bind(this)
    });

    // Strategy 2: Fetch PDF and extract with PDF.js (fallback)
    this.strategies.push({
      name: 'fetch-pdfjs',
      priority: 2,
      canHandle: (url: string) => this.isPDFUrl(url) && this.canFetchUrl(url),
      extract: this.extractWithFetchPDFJS.bind(this)
    });

    // Sort strategies by priority
    this.strategies.sort((a, b) => a.priority - b.priority);
    this.isInitialized = true;
    console.log('📄 PDF extraction strategies initialized:', this.strategies.map(s => s.name));
  }

  /**
   * Check if a URL is a PDF based on URL patterns
   */
  private static isPDFUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    
    // Standard PDF URL patterns
    if (lowerUrl.endsWith('.pdf') || 
        lowerUrl.includes('.pdf?') || 
        lowerUrl.includes('.pdf#') ||
        (url.startsWith('file://') && lowerUrl.includes('.pdf'))) {
      return true;
    }
    
    // Academic PDF URLs
    if (lowerUrl.includes('arxiv.org/pdf/') ||
        (lowerUrl.includes('biorxiv.org') && lowerUrl.includes('.full.pdf')) ||
        (lowerUrl.includes('medrxiv.org') && lowerUrl.includes('.full.pdf')) ||
        (lowerUrl.includes('researchgate.net') && lowerUrl.includes('.pdf')) ||
        (lowerUrl.includes('academia.edu') && lowerUrl.includes('.pdf')) ||
        (lowerUrl.includes('ncbi.nlm.nih.gov/pmc/') && lowerUrl.includes('pdf'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if we can fetch a URL (not local files, etc.)
   */
  private static canFetchUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Clean URL by removing UTM and tracker parameters
   */
  private static cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const trackerParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source', 'referrer', 'campaign', 'medium'
      ];
      trackerParams.forEach(param => urlObj.searchParams.delete(param));
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Load PDF.js from chrome extension
   */
  private static async loadPDFJS(): Promise<any> {
    if (!window.pdfjsLib) {
      console.log('📄 Loading PDF.js from chrome extension...');
      const pdfModule = await import(chrome.runtime.getURL('pdf.mjs'));
      window.pdfjsLib = pdfModule.default || pdfModule;
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
      console.log('📄 PDF.js loaded and configured');
    }
    return window.pdfjsLib;
  }

  /**
   * Extract metadata from academic PDF URLs
   */
  private static extractMetadataFromUrl(url: string, title?: string): PageMetadata {
    console.log('📄 Extracting metadata from URL:', url);
    
    const metadata: PageMetadata = {
      title: title || 'PDF Document',
      contentType: 'pdf',
      citations: {}
    };

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // arXiv extraction
      if (domain.includes('arxiv.org')) {
        console.log('📄 Detected arXiv URL');
        
        // Extract arXiv ID from various URL patterns
        let arxivId = '';
        
        // Pattern 1: arxiv.org/pdf/1234.5678.pdf
        const pdfMatch = url.match(/arxiv\.org\/pdf\/([^\/\?]+)/);
        if (pdfMatch) {
          arxivId = pdfMatch[1].replace(/\.pdf$/, '').replace(/v\d+$/, '');
        }
        
        // Pattern 2: arxiv.org/abs/1234.5678
        const absMatch = url.match(/arxiv\.org\/abs\/([^\/\?]+)/);
        if (absMatch) {
          arxivId = absMatch[1].replace(/v\d+$/, '');
        }
        
        if (arxivId) {
          console.log('📄 Extracted arXiv ID:', arxivId);
          metadata.citations!.arxiv = arxivId;
          metadata.citations!.type = 'preprint';
          metadata.citations!.publisher = 'arXiv';
          metadata.citations!.url = `https://arxiv.org/abs/${arxivId}`;
          metadata.citations!.pdf_url = `https://arxiv.org/pdf/${arxivId}.pdf`;
          
          // Extract year from arXiv ID (format: YYMM.NNNNN where YY is 2-digit year)
          // For 2503.04412 -> YY=25, MM=03 -> year should be 2025
          const yearMatch = arxivId.match(/^(\d{2})(\d{2})\./);
          if (yearMatch) {
            const yy = parseInt(yearMatch[1]); // First 2 digits (25)
            // Convert YY to YYYY: 00-30 = 2000-2030, 31-99 = 1931-1999
            const year = yy <= 30 ? `20${yy.toString().padStart(2, '0')}` : `19${yy}`;
            console.log('📄 Extracted year from arXiv ID:', `${yy} -> ${year}`);
            metadata.citations!.year = year;
            metadata.publishedDate = year;
          }
          
          // Generate a better title if we only have generic title
          if (!title || title === 'PDF Document') {
            metadata.title = `arXiv:${arxivId}`;
          }
        }
      }
      
      // bioRxiv/medRxiv extraction
      else if (domain.includes('biorxiv.org') || domain.includes('medrxiv.org')) {
        console.log('📄 Detected bioRxiv/medRxiv URL');
        
        const platform = domain.includes('biorxiv.org') ? 'bioRxiv' : 'medRxiv';
        
        // Extract paper ID: platform.org/content/early/2023/01/01/2023.01.01.123456
        const bioMatch = url.match(/(\w+rxiv)\.org\/content\/.*?(\d{4}\.\d{2}\.\d{2}\.\d+)/);
        if (bioMatch) {
          const paperId = bioMatch[2];
          console.log('📄 Extracted paper ID:', paperId);
          
          metadata.citations!.type = 'preprint';
          metadata.citations!.publisher = platform;
          metadata.citations!.identifier = paperId;
          
          // Extract year from paper ID
          const yearMatch = paperId.match(/^(\d{4})/);
          if (yearMatch) {
            metadata.citations!.year = yearMatch[1];
            metadata.publishedDate = yearMatch[1];
          }
          
          // Generate a better title if we only have generic title
          if (!title || title === 'PDF Document') {
            metadata.title = `${platform} ${paperId}`;
          }
        }
      }
      
      // PubMed Central extraction
      else if (domain.includes('ncbi.nlm.nih.gov') && url.includes('/pmc/')) {
        console.log('📄 Detected PMC URL');
        
        // Extract PMC ID: ncbi.nlm.nih.gov/pmc/articles/PMC1234567/
        const pmcMatch = url.match(/\/pmc\/articles\/(PMC\d+)/);
        if (pmcMatch) {
          const pmcId = pmcMatch[1];
          console.log('📄 Extracted PMC ID:', pmcId);
          
          metadata.citations!.pmcid = pmcId;
          metadata.citations!.type = 'journal-article';
          metadata.citations!.publisher = 'PubMed Central';
          
          // Generate a better title if we only have generic title
          if (!title || title === 'PDF Document') {
            metadata.title = `PMC ${pmcId}`;
          }
        }
      }
      
      // DOI-based URLs
      else if (url.includes('doi.org') || url.includes('/doi/')) {
        console.log('📄 Detected DOI URL');
        
        // Extract DOI: doi.org/10.1234/example or publisher.com/doi/10.1234/example
        const doiMatch = url.match(/doi\.org\/(.+?)(?:\?|$|#)|\/doi\/(.+?)(?:\?|$|#)/);
        if (doiMatch) {
          const doi = doiMatch[1] || doiMatch[2];
          console.log('📄 Extracted DOI:', doi);
          
          metadata.citations!.doi = doi;
          metadata.citations!.type = 'journal-article';
          
          // Try to extract year from DOI if possible
          const yearMatch = doi.match(/(\d{4})/);
          if (yearMatch) {
            metadata.citations!.year = yearMatch[1];
            metadata.publishedDate = yearMatch[1];
          }
          
          // Generate a better title if we only have generic title
          if (!title || title === 'PDF Document') {
            metadata.title = `DOI: ${doi}`;
          }
        }
      }
      
      // ResearchGate extraction
      else if (domain.includes('researchgate.net')) {
        console.log('📄 Detected ResearchGate URL');
        metadata.citations!.type = 'journal-article';
        metadata.citations!.publisher = 'ResearchGate';
        
        // Try to extract publication info from URL path
        const pathMatch = url.match(/\/publication\/(\d+)/);
        if (pathMatch) {
          metadata.citations!.identifier = pathMatch[1];
        }
      }
      
      // Academia.edu extraction
      else if (domain.includes('academia.edu')) {
        console.log('📄 Detected Academia.edu URL');
        metadata.citations!.type = 'journal-article';
        metadata.citations!.publisher = 'Academia.edu';
      }
      
      // Generic academic domains
      else if (domain.includes('springer.com') || domain.includes('nature.com') || 
               domain.includes('science.org') || domain.includes('cell.com') ||
               domain.includes('wiley.com') || domain.includes('elsevier.com') ||
               domain.includes('sciencedirect.com') || domain.includes('ieee.org')) {
        console.log('📄 Detected academic publisher URL');
        metadata.citations!.type = 'journal-article';
        
        // Set publisher based on domain
        if (domain.includes('springer.com')) metadata.citations!.publisher = 'Springer';
        else if (domain.includes('nature.com')) metadata.citations!.publisher = 'Nature Publishing Group';
        else if (domain.includes('science.org')) metadata.citations!.publisher = 'Science';
        else if (domain.includes('cell.com')) metadata.citations!.publisher = 'Cell Press';
        else if (domain.includes('wiley.com')) metadata.citations!.publisher = 'Wiley';
        else if (domain.includes('elsevier.com') || domain.includes('sciencedirect.com')) metadata.citations!.publisher = 'Elsevier';
        else if (domain.includes('ieee.org')) metadata.citations!.publisher = 'IEEE';
      }
      
      // Set domain for all cases
      metadata.domain = domain;
      
      console.log('📄 Extracted metadata from URL:', {
        title: metadata.title,
        citations: metadata.citations,
        domain: metadata.domain
      });
      
    } catch (error) {
      console.warn('📄 Error extracting metadata from URL:', error);
    }
    
    return metadata;
  }

  /**
   * Generate canonical filename for PDF
   */
  static generateCanonicalFilename(url: string, metadata: PageMetadata): string {
    console.log('📄 Generating canonical filename for PDF');
    
    // Helper function to clean and truncate text for filenames
    const cleanForFilename = (text: string, maxLength: number = 30): string => {
      return text
        .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .substring(0, maxLength)
        .toLowerCase();
    };

    // Helper function to extract meaningful title keywords
    const extractTitleKeywords = (title: string): string => {
      console.log('📄 DEBUG: Extracting title keywords from:', title);
      if (!title || title === 'PDF Document') {
        console.log('📄 DEBUG: Title is empty or generic, returning empty string');
        return '';
      }
      
      // Remove common academic prefixes/suffixes and clean up
      let cleanTitle = title
        .replace(/^(arXiv:|DOI:|PMC\s+)/i, '') // Remove prefixes
        .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parenthetical content
        .replace(/[^\w\s-]/g, ' ') // Replace special chars with spaces
        .replace(/\s+/g, ' ') // Collapse spaces
        .trim();
      
      console.log('📄 DEBUG: Cleaned title:', cleanTitle);
      
      // Split into words and filter out common stop words
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'under', 'over', 'across', 'around', 'near', 'far', 'against', 'toward', 'towards', 'upon', 'concerning', 'regarding', 'via', 'per', 'using', 'based', 'analysis', 'study', 'research', 'paper', 'article', 'review', 'survey', 'approach', 'method', 'technique', 'algorithm', 'framework', 'model', 'system']);
      
      const words = cleanTitle.split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word.toLowerCase()))
        .slice(0, 4); // Take first 4 meaningful words
      
      console.log('📄 DEBUG: Filtered words:', words);
      const result = words.join('_').toLowerCase();
      console.log('📄 DEBUG: Title keywords result:', result);
      return result;
    };

    // Helper function to get author last names
    const getAuthorLastNames = (metadata: PageMetadata): string => {
      console.log('📄 DEBUG: Getting author last names from metadata:', {
        'metadata.citations?.authors': metadata.citations?.authors,
        'metadata.author': metadata.author,
        'authors type': typeof metadata.citations?.authors,
        'authors isArray': Array.isArray(metadata.citations?.authors)
      });
      
      const authors = metadata.citations?.authors || [];
      if (!Array.isArray(authors) || authors.length === 0) {
        console.log('📄 DEBUG: No authors array found, trying author field');
        // Try to extract from author field if available
        const authorField = metadata.author;
        if (authorField && typeof authorField === 'string') {
          console.log('📄 DEBUG: Found author field:', authorField);
          // Split by common delimiters and extract last names
          const authorNames = authorField.split(/[,;&]+/).map(name => name.trim());
          const lastNames = authorNames.map(name => {
            const parts = name.split(/\s+/);
            return parts[parts.length - 1]; // Get last part as last name
          }).filter(name => name.length > 1);
          
          if (lastNames.length > 0) {
            const result = lastNames.slice(0, 2).join('_').toLowerCase(); // Max 2 authors
            console.log('📄 DEBUG: Extracted from author field:', result);
            return result;
          }
        }
        console.log('📄 DEBUG: No usable author information found');
        return '';
      }
      
      console.log('📄 DEBUG: Processing authors array:', authors);
      // Extract last names from authors array
      const lastNames = authors.map(author => {
        if (typeof author !== 'string') return '';
        const parts = author.trim().split(/\s+/);
        return parts[parts.length - 1]; // Get last part as last name
      }).filter(name => name.length > 1);
      
      console.log('📄 DEBUG: Extracted last names:', lastNames);
      
      if (lastNames.length === 0) return '';
      
      // Use first author, or first two if multiple
      let result = '';
      if (lastNames.length === 1) {
        result = cleanForFilename(lastNames[0], 15);
      } else {
        result = cleanForFilename(`${lastNames[0]}_${lastNames[1]}`, 20);
      }
      
      console.log('📄 DEBUG: Final author result:', result);
      return result;
    };

    // Build filename components
    const components: string[] = [];
    
    console.log('📄 DEBUG: Starting filename generation with metadata:', {
      title: metadata.title,
      author: metadata.author,
      citations: metadata.citations
    });
    
    // 1. Try to get author last names first
    const authorNames = getAuthorLastNames(metadata);
    console.log('📄 DEBUG: Author names result:', authorNames);
    if (authorNames) {
      components.push(authorNames);
      console.log('📄 DEBUG: Added author names to components');
    } else {
      console.log('📄 DEBUG: No author names found, skipping');
    }
    
    // 2. Add title keywords
    const titleKeywords = extractTitleKeywords(metadata.title || '');
    console.log('📄 DEBUG: Title keywords result:', titleKeywords);
    if (titleKeywords) {
      components.push(titleKeywords);
      console.log('📄 DEBUG: Added title keywords to components');
    } else {
      console.log('📄 DEBUG: No title keywords found, skipping');
    }
    
    // 3. Add academic identifier as a suffix for uniqueness
    let identifier = '';
    const arxivId = metadata.citations?.arxiv;
    const doi = metadata.citations?.doi;
    const pmcid = metadata.citations?.pmcid;
    const bioRxivId = metadata.citations?.identifier;
    
    console.log('📄 DEBUG: Academic identifiers:', { arxivId, doi, pmcid, bioRxivId });
    
    if (arxivId) {
      identifier = `arxiv_${arxivId.replace(/\./g, '_')}`;
    } else if (doi) {
      const doiSuffix = doi.split('/').pop()?.replace(/[^\w.-]/g, '_').substring(0, 15);
      if (doiSuffix) {
        identifier = `doi_${doiSuffix}`;
      }
    } else if (pmcid) {
      identifier = pmcid.toLowerCase();
    } else if (bioRxivId) {
      identifier = `biorxiv_${bioRxivId.replace(/[^\w.-]/g, '_')}`;
    }
    
    console.log('📄 DEBUG: Generated identifier:', identifier);
    if (identifier) {
      components.push(identifier);
      console.log('📄 DEBUG: Added identifier to components');
    }
    
    console.log('📄 DEBUG: Final components array:', components);
    
    // 4. If we have components, join them
    if (components.length > 0) {
      let filename = components.join('_');
      
      // Ensure filename isn't too long (max 100 chars before .pdf)
      if (filename.length > 100) {
        filename = filename.substring(0, 100);
      }
      
      // Clean up any trailing underscores
      filename = filename.replace(/_+$/, '');
      
      console.log('📄 Generated memorable filename:', `${filename}.pdf`);
      return `${filename}.pdf`;
    }
    
    // 5. Fallback to URL-based extraction if no metadata available
    console.log('📄 DEBUG: No components found, falling back to URL-based extraction');
    try {
      const urlObj = new URL(url);
      
      // arXiv URL patterns
      if (urlObj.hostname.includes('arxiv.org')) {
        const arxivMatch = url.match(/arxiv\.org\/(?:pdf|abs)\/([^\/\?]+)/);
        if (arxivMatch) {
          const arxivId = arxivMatch[1].replace(/\.pdf$/, '').replace(/v\d+$/, '');
          console.log('📄 FALLBACK: Using arXiv ID from URL:', arxivId);
          return `arxiv_${arxivId}.pdf`;
        }
      }
      
      // bioRxiv/medRxiv URL patterns
      if (urlObj.hostname.includes('biorxiv.org') || urlObj.hostname.includes('medrxiv.org')) {
        const bioMatch = url.match(/(\w+rxiv)\.org\/content\/.*?(\d{4}\.\d{2}\.\d{2}\.\d+)/);
        if (bioMatch) {
          const paperId = bioMatch[2];
          console.log('📄 Fallback: Using bioRxiv/medRxiv ID from URL:', paperId);
          return `${bioMatch[1]}_${paperId}.pdf`;
        }
      }
      
      // Generic PDF filename from URL
      let filename = urlObj.pathname.split('/').pop() || '';
      filename = filename.split('?')[0].split('#')[0];
      
      if (filename && filename.toLowerCase().endsWith('.pdf')) {
        console.log('📄 Fallback: Using URL filename:', filename);
        return filename;
      }
      
      // Final fallback
      const domain = urlObj.hostname.replace(/[^a-zA-Z0-9\-_]/g, '');
      const timestamp = new Date().toISOString().split('T')[0];
      const fallbackFilename = `${domain}_${timestamp}.pdf`;
      console.log('📄 Fallback: Using domain and timestamp:', fallbackFilename);
      return fallbackFilename;
      
    } catch (error) {
      console.warn('📄 Error in filename fallback generation:', error);
      return 'document.pdf';
    }
  }

  /**
   * Strategy 1: Extract PDF using Chrome Extension PDF.js
   */
  private static async extractWithChromeExtensionPDFJS(url: string, title?: string): Promise<PDFExtractionResult> {
    try {
      console.log('📄 Attempting PDF extraction with Chrome Extension PDF.js:', url);
      
      const pdfjsLib = await this.loadPDFJS();
      
      // Load PDF from URL
      const pdf = await pdfjsLib.getDocument(url).promise;
      console.log('📄 PDF loaded, total pages:', pdf.numPages);
      
      let content = '';
      const maxPages = Math.min(pdf.numPages, 50); // Limit for performance
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText) {
            content += pageText + '\n\n';
          }
          
          // Break if content is getting too long
          if (content.length > 100000) {
            content += '\n\n[Content truncated due to length...]';
            break;
          }
        } catch (pageError) {
          console.warn(`📄 Error processing page ${i}:`, pageError);
          content += `\n\n[Error processing page ${i}]\n\n`;
        }
      }
      
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const cleanedUrl = this.cleanUrl(url);
      const domain = url.startsWith('file://') ? 'Local File' : new URL(url).hostname;
      
      // Extract metadata from URL first
      let metadata = this.extractMetadataFromUrl(url, title);
      
      // Add technical metadata
      metadata.contentType = 'pdf';
      metadata.domain = domain;
      metadata.citations = metadata.citations || {};
      metadata.citations.pageCount = pdf.numPages;
      metadata.citations.extractedPages = Math.min(maxPages, pdf.numPages);
      metadata.citations.wordCount = wordCount;
      metadata.citations.isPDF = true;
      metadata.citations.format = 'PDF';
      
      // Enhance metadata with PDF content-based citations if content is available
      // Only run in background context (not content script) to avoid API access issues
      if (content.trim() && typeof chrome !== 'undefined' && chrome.runtime && !window.location.protocol.startsWith('http')) {
        try {
          // Dynamically import PDF citation service to avoid issues in content script context
          const { PDFCitationService } = await import('./pdfCitationService.svelte');
          if (PDFCitationService.hasAcademicCitationInfo(content)) {
            console.log('📄📚 Enhancing PDF metadata with content-based citations');
            metadata = await PDFCitationService.enhanceMetadataWithPDFCitations(content, url, metadata);
            console.log('✅ PDF metadata enhanced with content-based citations');
            
            // ✅ FIX: Log the enhanced metadata to verify it's working
            console.log('📊 Enhanced metadata fields:', Object.keys(metadata));
            console.log('📄 Enhanced title:', metadata.title);
            console.log('👥 Enhanced author:', metadata.author);
            console.log('📝 Enhanced description:', metadata.description);
            if (metadata.citations) {
              console.log('📚 Enhanced citations fields:', Object.keys(metadata.citations));
              console.log('📄 Citation title:', metadata.citations.title);
              console.log('👥 Citation authors:', metadata.citations.authors);
              console.log('📝 Citation abstract:', metadata.citations.abstract);
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to enhance PDF metadata with content-based citations:', error);
        }
      }
      
      // ✅ SKIP FILENAME GENERATION: Let background script handle this after citation enhancement
      // metadata.filename = this.generateCanonicalFilename(url, metadata);
      
      // ✅ FIX: Use enhanced title from metadata for content structure
      const finalTitle = metadata.title || 'PDF Document';
      
      return {
        success: true,
        extractionMethod: 'chrome-extension-pdfjs',
        content: {
          url: cleanedUrl,
          text: content.trim() || 'No text content could be extracted from this PDF.',
          html: `<div class="pdf-content"><h1>📄 ${finalTitle}</h1><pre>${content.trim()}</pre></div>`,
          title: finalTitle,
          metadata: metadata,
          wordCount,
          markdown: `# ${finalTitle}\n\n${content.trim()}`,
          extractedAt: Date.now()
        }
      };
      
    } catch (error) {
      console.error('📄 Chrome Extension PDF.js extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chrome Extension PDF.js extraction failed',
        extractionMethod: 'chrome-extension-pdfjs'
      };
    }
  }

  /**
   * Strategy 2: Fetch PDF and extract with PDF.js
   */
  private static async extractWithFetchPDFJS(url: string, title?: string): Promise<PDFExtractionResult> {
    try {
      console.log('📄 Attempting PDF extraction with Fetch + PDF.js:', url);
      
      const pdfjsLib = await this.loadPDFJS();
      
      // Fetch PDF with browser-like headers
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (compatible; SideNote Extension)',
          'Referer': window.location.href
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('📄 PDF fetched, size:', arrayBuffer.byteLength);
      
      // Load PDF from ArrayBuffer
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      console.log('📄 PDF loaded, total pages:', pdf.numPages);
      
      let content = '';
      const maxPages = Math.min(pdf.numPages, 50);
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText) {
            content += pageText + '\n\n';
          }
          
          if (content.length > 100000) {
            content += '\n\n[Content truncated due to length...]';
            break;
          }
        } catch (pageError) {
          console.warn(`📄 Error processing page ${i}:`, pageError);
          content += `\n\n[Error processing page ${i}]\n\n`;
        }
      }
      
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const cleanedUrl = this.cleanUrl(url);
      const domain = new URL(url).hostname;
      
      // Extract metadata from URL first
      let metadata = this.extractMetadataFromUrl(url, title);
      
      // Add technical metadata
      metadata.contentType = 'pdf';
      metadata.domain = domain;
      metadata.citations = metadata.citations || {};
      metadata.citations.pageCount = pdf.numPages;
      metadata.citations.extractedPages = Math.min(maxPages, pdf.numPages);
      metadata.citations.wordCount = wordCount;
      metadata.citations.isPDF = true;
      metadata.citations.format = 'PDF';
      
      // Enhance metadata with PDF content-based citations if content is available
      // Only run in background context (not content script) to avoid API access issues
      if (content.trim() && typeof chrome !== 'undefined' && chrome.runtime && !window.location.protocol.startsWith('http')) {
        try {
          // Dynamically import PDF citation service to avoid issues in content script context
          const { PDFCitationService } = await import('./pdfCitationService.svelte');
          if (PDFCitationService.hasAcademicCitationInfo(content)) {
            console.log('📄📚 Enhancing PDF metadata with content-based citations');
            metadata = await PDFCitationService.enhanceMetadataWithPDFCitations(content, url, metadata);
            console.log('✅ PDF metadata enhanced with content-based citations');
            
            // ✅ FIX: Log the enhanced metadata to verify it's working
            console.log('📊 Enhanced metadata fields:', Object.keys(metadata));
            console.log('📄 Enhanced title:', metadata.title);
            console.log('👥 Enhanced author:', metadata.author);
            console.log('📝 Enhanced description:', metadata.description);
            if (metadata.citations) {
              console.log('📚 Enhanced citations fields:', Object.keys(metadata.citations));
              console.log('📄 Citation title:', metadata.citations.title);
              console.log('👥 Citation authors:', metadata.citations.authors);
              console.log('📝 Citation abstract:', metadata.citations.abstract);
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to enhance PDF metadata with content-based citations:', error);
        }
      }
      
      // ✅ SKIP FILENAME GENERATION: Let background script handle this after citation enhancement
      // metadata.filename = this.generateCanonicalFilename(url, metadata);
      
      // ✅ FIX: Use enhanced title from metadata for content structure
      const finalTitle = metadata.title || 'PDF Document';
      
      return {
        success: true,
        extractionMethod: 'fetch-pdfjs',
        content: {
          url: cleanedUrl,
          text: content.trim() || 'No text content could be extracted from this PDF.',
          html: `<div class="pdf-content"><h1>📄 ${finalTitle}</h1><pre>${content.trim()}</pre></div>`,
          title: finalTitle,
          metadata: metadata,
          wordCount,
          markdown: `# ${finalTitle}\n\n${content.trim()}`,
          extractedAt: Date.now()
        }
      };
      
    } catch (error) {
      console.error('📄 Fetch + PDF.js extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fetch + PDF.js extraction failed',
        extractionMethod: 'fetch-pdfjs'
      };
    }
  }

  /**
   * Main extraction method - tries strategies in order of priority
   */
  static async extractPDF(url: string, title?: string): Promise<PDFExtractionResult> {
    await this.initializeStrategies();
    
    console.log('📄 Starting PDF extraction with fallback strategies for:', url);
    
    for (const strategy of this.strategies) {
      if (strategy.canHandle(url)) {
        console.log(`📄 Trying strategy: ${strategy.name}`);
        
        try {
          const result = await strategy.extract(url, title);
          
          if (result.success) {
            console.log(`✅ PDF extraction successful with strategy: ${strategy.name}`);
            return result;
          } else {
            console.log(`❌ Strategy ${strategy.name} failed: ${result.error}`);
          }
        } catch (error) {
          console.log(`❌ Strategy ${strategy.name} threw error:`, error);
        }
      } else {
        console.log(`⏭️ Strategy ${strategy.name} cannot handle this URL`);
      }
    }
    
    return {
      success: false,
      error: 'All PDF extraction strategies failed',
      extractionMethod: 'none'
    };
  }

  /**
   * Extract PDF and save to TabData
   */
  static async extractAndSaveToTabData(url: string, title?: string): Promise<boolean> {
    try {
      console.log('📄 Extracting PDF and saving to TabData:', url);
      
      const extractionResult = await this.extractPDF(url, title);
      
      if (!extractionResult.success || !extractionResult.content) {
        console.error('📄 PDF extraction failed:', extractionResult.error);
        return false;
      }
      
      const { content } = extractionResult;
      
      // Prepare TabData structure
      const tabDataUpdate = {
        content: {
          url: content.url,
          text: content.text,
          html: content.html,
          title: content.title,
          metadata: {
            ...content.metadata,
            extractionMethod: extractionResult.extractionMethod,
            isPDF: true
          },
          markdown: content.markdown,
          wordCount: content.wordCount,
          extractedAt: content.extractedAt
        }
      };
      
      // Save to data controller
      const saveSuccess = await contentDataController.saveData(content.url, tabDataUpdate);
      
      if (saveSuccess) {
        console.log('✅ PDF content saved to TabData successfully');
        return true;
      } else {
        console.error('❌ Failed to save PDF content to TabData');
        return false;
      }
      
    } catch (error) {
      console.error('📄 Error in extractAndSaveToTabData:', error);
      return false;
    }
  }

  /**
   * Check if current page is a PDF
   */
  static isCurrentPagePDF(): boolean {
    const currentUrl = window.location.href;
    return this.isPDFUrl(currentUrl);
  }

  /**
   * Check if current page has embedded PDF
   */
  static hasEmbeddedPDF(): boolean {
    // Check for PDF embed tags
    const pdfEmbeds = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
    if (pdfEmbeds.length > 0) {
      return true;
    }
    
    // Check for iframe with PDF src
    const pdfIframes = document.querySelectorAll('iframe');
    for (const iframe of pdfIframes) {
      const src = iframe.src || iframe.getAttribute('src') || '';
      if (this.isPDFUrl(src)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get embedded PDF URL from the page
   */
  static getEmbeddedPDFUrl(): string | null {
    // Check embed tags
    const pdfEmbeds = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
    for (const embed of pdfEmbeds) {
      const src = embed.getAttribute('src');
      if (src && src !== 'about:blank') {
        return src;
      }
    }
    
    // Check iframes
    const pdfIframes = document.querySelectorAll('iframe');
    for (const iframe of pdfIframes) {
      const src = iframe.src || iframe.getAttribute('src') || '';
      if (this.isPDFUrl(src)) {
        return src;
      }
    }
    
    return null;
  }
}

// Add type declaration for PDF.js global
declare global {
  interface Window {
    pdfjsLib: any;
  }
} 