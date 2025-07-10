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
   */
  static generateIntelligentFilename(options: PDFDownloadOptions): string {
    const { url, title, tabData } = options;
    
    console.log('🔍 Generating filename for:', { 
      url, 
      title, 
      hasTabData: !!tabData,
      hasContent: !!tabData?.content,
      hasMetadata: !!tabData?.content?.metadata,
      metadata: tabData?.content?.metadata 
    });
    
    try {
      // Priority 1: Use canonical filename from metadata if available
      const metadata = tabData?.content?.metadata;
      if (metadata?.filename) {
        console.log('✅ Using canonical filename from metadata:', metadata.filename);
        return metadata.filename;
      }
      
      // Priority 2: Extract from metadata if available
      if (metadata) {
        console.log('📊 Found metadata:', metadata);
        let filename = '';
        
        // Check for arXiv ID first (highest priority for arXiv papers)
        const arxivId = metadata.citations?.arxiv;
        if (arxivId) {
          console.log('📄 Found arXiv ID:', arxivId);
          
          // For arXiv papers, prefer simple naming: arxivId.pdf or Author_Year_arxivId.pdf
          
          // Try to extract author from various metadata fields
          const author = metadata.author || 
                        metadata.citations?.authors?.[0] || 
                        metadata.citations?.first_author;
          
          let authorPart = '';
          if (author) {
            const lastNameMatch = author.match(/([A-Za-z]+)(?:\s|,|$)/);
            if (lastNameMatch && lastNameMatch[1].length > 2) {
              authorPart = lastNameMatch[1];
              console.log('👤 Found author:', authorPart);
            }
          }
          
          // Add year if available
          let yearPart = '';
          const year = metadata.citations?.year || 
                       metadata.citations?.publication_date || 
                       metadata.publishedDate;
          
          if (year) {
            const yearMatch = year.toString().match(/(\d{4})/);
            if (yearMatch) {
              yearPart = yearMatch[1];
              console.log('📅 Found year:', yearPart);
            }
          }
          
          // Generate filename based on available information
          if (authorPart && yearPart) {
            filename = `${authorPart}_${yearPart}_${arxivId}`;
          } else if (authorPart) {
            filename = `${authorPart}_${arxivId}`;
          } else {
            filename = arxivId;
          }
          
          console.log('✅ Generated arXiv filename:', filename);
          return `${filename}.pdf`;
        }
        
        // Check for other academic identifiers
        const doi = metadata.citations?.doi;
        const pmcid = metadata.citations?.pmcid;
        const bioRxivId = metadata.citations?.identifier;
        
        if (doi || pmcid || bioRxivId) {
          // Try to extract author from various metadata fields
          const author = metadata.author || 
                        metadata.citations?.authors?.[0] || 
                        metadata.citations?.first_author;
          
          if (author) {
            const lastNameMatch = author.match(/([A-Za-z]+)(?:\s|,|$)/);
            if (lastNameMatch) {
              filename += lastNameMatch[1];
              console.log('👤 Added author:', lastNameMatch[1]);
            }
          }
          
          // Add year if available
          const year = metadata.citations?.year || 
                       metadata.citations?.publication_date || 
                       metadata.publishedDate;
          
          if (year) {
            const yearMatch = year.toString().match(/(\d{4})/);
            if (yearMatch) {
              filename += `_${yearMatch[1]}`;
              console.log('📅 Added year:', yearMatch[1]);
            }
          }
          
          // Add identifier
          if (doi) {
            const doiSuffix = doi.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
            if (doiSuffix) {
              filename += `_doi_${doiSuffix}`;
              console.log('🔗 Added DOI:', doiSuffix);
            }
          } else if (pmcid) {
            filename += `_${pmcid}`;
            console.log('🔗 Added PMC ID:', pmcid);
          } else if (bioRxivId) {
            filename += `_${bioRxivId}`;
            console.log('🔗 Added bioRxiv ID:', bioRxivId);
          }
          
          if (filename) {
            console.log('✅ Generated academic filename:', filename);
            return `${filename}.pdf`;
          }
        }
        
        // Fallback to general metadata approach
        // Try to extract author from various metadata fields
        const author = metadata.author || 
                      metadata.citations?.authors?.[0] || 
                      metadata.citations?.first_author;
        
        if (author) {
          const lastNameMatch = author.match(/([A-Za-z]+)(?:\s|,|$)/);
          if (lastNameMatch) {
            filename += lastNameMatch[1];
            console.log('👤 Added author:', lastNameMatch[1]);
          }
        }
        
        // Try to extract year from various metadata fields
        const year = metadata.citations?.year || 
                     metadata.citations?.publication_date || 
                     metadata.publishedDate;
        
        if (year) {
          const yearMatch = year.toString().match(/(\d{4})/);
          if (yearMatch) {
            filename += `_${yearMatch[1]}`;
            console.log('📅 Added year:', yearMatch[1]);
          }
        }
        
        // Add title keywords (first few meaningful words)
        const titleSource = metadata.title || title || tabData?.content?.title;
        if (titleSource) {
          const titleWords = titleSource
            .toLowerCase()
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .split(/\s+/)
            .filter((word: string) => word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'using', 'based', 'arxiv'].includes(word))
            .slice(0, 3)
            .join('_');
          
          if (titleWords) {
            filename += `_${titleWords}`;
            console.log('📝 Added title words:', titleWords);
          }
        }
        
        if (filename) {
          console.log('✅ Generated filename from metadata:', filename);
          return `${filename}.pdf`;
        }
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