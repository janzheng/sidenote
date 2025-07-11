import type { TabData } from '../../types/tabData';
import type { CitationData } from '../../types/citations';

export interface PDFDownloadOptions {
  url: string;
  filename?: string;
  title?: string;
  citationData?: CitationData;
  tabData?: TabData;
}

export interface PDFDownloadResult {
  success: boolean;
  error?: string;
  filename?: string;
  downloadId?: string;
}

/**
 * PDF Download Service
 * Provides intelligent filename generation and download functionality for PDFs
 */
export class PDFDownloadService {
  
  /**
   * Generate intelligent filename based on citation data and metadata
   * This now primarily relies on the enhanced filename from PDFCitationService
   */
  static generateIntelligentFilename(options: PDFDownloadOptions): string {
    const { url, title, tabData } = options;
    
    console.log('🔍 Generating filename for:', { 
      url, 
      title, 
      hasTabData: !!tabData,
      hasContent: !!tabData?.content,
      hasMetadata: !!tabData?.content?.metadata,
      hasEnhancedFilename: !!tabData?.content?.metadata?.filename
    });
    
    try {
      // Priority 1: Use enhanced filename from PDFCitationService if available
      const metadata = tabData?.content?.metadata;
      if (metadata?.filename) {
        console.log('✅ Using enhanced filename from PDFCitationService:', metadata.filename);
        return metadata.filename;
      }
      
      // Priority 2: Simple fallback for arXiv papers
      if (metadata?.citations?.arxiv) {
        const arxivId = metadata.citations.arxiv;
        console.log('📄 Using simple arXiv fallback:', `${arxivId}.pdf`);
        return `${arxivId}.pdf`;
      }
      
      // Priority 3: Extract from arXiv URL pattern
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('arxiv.org')) {
        const arxivMatch = url.match(/arxiv\.org\/pdf\/([^\/\?]+)/);
        if (arxivMatch) {
          const arxivId = arxivMatch[1].replace(/\.pdf$/, '').replace(/v\d+$/, '');
          console.log('📄 Generated arXiv filename:', `${arxivId}.pdf`);
          return `${arxivId}.pdf`;
        }
      }
      
      // Also check for arXiv abstract URLs
      if (urlObj.hostname.includes('arxiv.org') && url.includes('/abs/')) {
        const arxivMatch = url.match(/arxiv\.org\/abs\/([^\/\?]+)/);
        if (arxivMatch) {
          const arxivId = arxivMatch[1].replace(/v\d+$/, '');
          console.log('📄 Generated arXiv filename from abstract URL:', `${arxivId}.pdf`);
          return `${arxivId}.pdf`;
        }
      }
      
      // Priority 4: Extract from bioRxiv/medRxiv URLs
      if (urlObj.hostname.includes('biorxiv.org') || urlObj.hostname.includes('medrxiv.org')) {
        const bioMatch = url.match(/(\w+rxiv)\.org\/content\/.*?(\d{4}\.\d{2}\.\d{2}\.\d+)/);
        if (bioMatch) {
          const platform = bioMatch[1];
          const paperId = bioMatch[2];
          console.log('📄 Generated bioRxiv/medRxiv filename:', `${platform}_${paperId}.pdf`);
          return `${platform}_${paperId}.pdf`;
        }
      }
      
      // Priority 5: Extract from DOI URLs
      if (url.includes('doi.org') || url.includes('/doi/')) {
        const doiMatch = url.match(/doi\.org\/(.+?)(?:\?|$|#)/);
        if (doiMatch) {
          const doiSuffix = doiMatch[1].replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
          console.log('📄 Generated DOI filename:', `doi_${doiSuffix}.pdf`);
          return `doi_${doiSuffix}.pdf`;
        }
      }
      
      // Priority 6: Use existing filename from URL
      let filename = urlObj.pathname.split('/').pop() || '';
      filename = filename.split('?')[0].split('#')[0];
      
      if (filename && filename.toLowerCase().endsWith('.pdf')) {
        console.log('📄 Using URL filename:', filename);
        return filename;
      }
      
      // Priority 7: Try to extract a meaningful filename from the URL path
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 3) {
          // Clean up the path part to make it filename-friendly
          const cleanPath = lastPart
            .replace(/[^a-zA-Z0-9\-_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 30);
          
          if (cleanPath) {
            console.log('📄 Generated filename from URL path:', `${cleanPath}.pdf`);
            return `${cleanPath}.pdf`;
          }
        }
      }
      
      // Priority 8: Generate from title
      const titleSource = title || tabData?.content?.title;
      if (titleSource) {
        const cleanTitle = titleSource
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 6) // Take first 6 words
          .join('_')
          .substring(0, 50);
        
        if (cleanTitle) {
          const timestamp = new Date().toISOString().split('T')[0];
          console.log('📄 Generated title-based filename:', `${cleanTitle}_${timestamp}.pdf`);
          return `${cleanTitle}_${timestamp}.pdf`;
        }
      }
      
      // Fallback: Domain + timestamp
      const domain = urlObj.hostname.replace(/[^a-zA-Z0-9\-_]/g, '');
      const timestamp = new Date().toISOString().split('T')[0];
      console.log('📄 Generated domain-based filename:', `${domain}_${timestamp}.pdf`);
      return `${domain}_${timestamp}.pdf`;
      
    } catch (error) {
      // Ultimate fallback
      const timestamp = new Date().toISOString().split('T')[0];
      console.log('⚠️ Using ultimate fallback filename:', `document_${timestamp}.pdf`);
      console.error('Error in filename generation:', error);
      return `document_${timestamp}.pdf`;
    }
  }

  /**
   * Download a PDF from the given URL
   */
  static async downloadPDF(options: PDFDownloadOptions): Promise<PDFDownloadResult> {
    const { url, filename: providedFilename } = options;
    
    try {
      console.log('📄 Starting PDF download from:', url);
      
      // Generate intelligent filename
      const filename = providedFilename || this.generateIntelligentFilename(options);
      console.log('📄 Generated filename:', filename);
      
      // Fetch the PDF
      console.log('📄 Fetching PDF content...');
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
      
      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.toLowerCase().includes('application/pdf')) {
        console.warn('⚠️ Warning: Content-Type is', contentType, 'not application/pdf');
      }
      
      // Get the PDF blob
      const blob = await response.blob();
      console.log('📄 PDF downloaded, size:', blob.size, 'bytes');
      
      // Create download link and trigger download
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL after a short delay
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
      
      console.log('✅ PDF download initiated:', filename);
      
      return {
        success: true,
        filename
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
      console.error('❌ PDF download failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if a URL is downloadable as a PDF
   */
  static canDownloadPDF(url: string): boolean {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      
      // Don't try to download from chrome-extension:// URLs
      if (urlObj.protocol === 'chrome-extension:') {
        return false;
      }
      
      // Don't try to download from file:// URLs (local files)
      if (urlObj.protocol === 'file:') {
        return false;
      }
      
      // Only allow http/https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get a user-friendly download button text based on the URL
   */
  static getDownloadButtonText(url: string, isDownloading: boolean = false): string {
    if (isDownloading) {
      return 'Downloading...';
    }
    
    if (!url) {
      return 'Download PDF';
    }
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      // Special handling for known academic domains
      if (domain.includes('arxiv.org')) {
        return 'Download from arXiv';
      } else if (domain.includes('nature.com')) {
        return 'Download from Nature';
      } else if (domain.includes('science.org')) {
        return 'Download from Science';
      } else if (domain.includes('cell.com')) {
        return 'Download from Cell';
      } else if (domain.includes('springer.com')) {
        return 'Download from Springer';
      } else if (domain.includes('wiley.com')) {
        return 'Download from Wiley';
      } else if (domain.includes('elsevier.com') || domain.includes('sciencedirect.com')) {
        return 'Download from Elsevier';
      } else {
        return 'Download PDF';
      }
    } catch (error) {
      return 'Download PDF';
    }
  }

  /**
   * Generate display filename for preview purposes
   */
  static generateDisplayFilename(options: PDFDownloadOptions): string {
    return this.generateIntelligentFilename(options);
  }
} 