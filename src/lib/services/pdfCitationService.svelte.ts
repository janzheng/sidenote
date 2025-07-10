import type { PageMetadata } from '../../types/pageMetadata';
import type { CitationResult } from '../../types/citations';
import { CitationService } from './citationService.svelte';
import { GroqService } from './groqService.svelte';

export interface PDFCitationExtractionResult {
  success: boolean;
  citations?: any;
  error?: string;
  extractionMethod?: 'ai-pdf-content' | 'url-metadata' | 'hybrid';
  confidence?: number;
}

/**
 * PDF Citation Service
 * Specialized service for extracting citation metadata from PDF content
 * Integrates with existing CitationService for comprehensive citation generation
 */
export class PDFCitationService {
  private static readonly MAX_CONTENT_LENGTH = 6000;
  // private static readonly MODEL = 'llama-3.1-8b-instant';
  private static readonly MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

  /**
   * Extract citation metadata from PDF content using AI
   */
  static async extractCitationFromPDFContent(
    pdfContent: string,
    url: string,
    existingMetadata?: PageMetadata
  ): Promise<PDFCitationExtractionResult> {
    try {
      console.log('📄📚 Starting PDF citation extraction from content');
      console.log('📊 Content length:', pdfContent.length);
      console.log('🔗 URL:', url);
      console.log('📋 Existing metadata available:', !!existingMetadata);

      // Truncate content to manageable size for AI processing
      const truncatedContent = pdfContent.substring(0, this.MAX_CONTENT_LENGTH);
      console.log('✂️ Truncated content to:', truncatedContent.length, 'characters');

      // Create the metadata schema for AI extraction
      const citationSchema = {
        title: "string - The paper/document title",
        authors: "array of strings - Author names (e.g., ['John Smith', 'Jane Doe'])",
        year: "string - Publication year (YYYY format)",
        journal: "string - Journal name (if academic paper)",
        publisher: "string - Publisher name",
        doi: "string - DOI identifier (if available)",
        arxiv: "string - arXiv identifier (if available, format: 1234.5678)",
        pmid: "string - PubMed ID (if available)",
        isbn: "string - ISBN (if book)",
        volume: "string - Journal volume number",
        issue: "string - Journal issue number",
        pages: "string - Page numbers (e.g., '123-145')",
        abstract: "string - Paper abstract or summary",
        keywords: "array of strings - Keywords or subject terms",
        publication_date: "string - Full publication date if available (YYYY-MM-DD)",
        conference: "string - Conference name (if conference paper)",
        type: "string - Document type (journal-article, conference-paper, preprint, book, etc.)"
      };

      // Create AI prompt for citation extraction
      const systemPrompt = `You are an expert academic metadata extractor. Your job is to analyze PDF content and extract comprehensive citation metadata for academic and research papers.

CRITICAL INSTRUCTIONS:
1. Focus on the FIRST PAGE and HEADER information where citation metadata is typically found
2. Look for title, authors, journal name, publication details, DOI, abstract
3. For arXiv papers, extract the arXiv ID (format: 1234.5678 or 1234.5678v1)
4. For journal articles, extract journal name, volume, issue, pages
5. Extract ALL author names as separate array elements
6. Return ONLY a clean JSON object with the citation metadata
7. If information is not found, omit that field from the JSON
8. Be precise with formatting - years as YYYY, pages as "start-end"

ARXIV YEAR EXTRACTION (ABSOLUTELY CRITICAL - READ CAREFULLY):
- NEVER extract year from arXiv ID numbers like "2503.04412" - this gives wrong years like "2503"
- For arXiv papers, look for ACTUAL DATES in the header like "6 Mar 2025" or "March 6, 2025"
- Common arXiv header formats: "1 arXiv:2503.04412v1 [cs.AI] 6 Mar 2025"
- Extract the year from the DATE portion: "6 Mar 2025" → year is "2025"
- Look for date patterns: "Jan 2025", "February 2024", "6 Mar 2025", "Dec 15, 2024"
- FALLBACK ONLY: If no date found, decode arXiv ID: 24XX.XXXXX = 2024, 25XX.XXXXX = 2025
- Example: "arXiv:2503.04412v1" without date → "25" means 2025, NOT 2503!

TITLE FORMATTING REQUIREMENTS (ABSOLUTELY CRITICAL):
- Fix OCR spacing artifacts: "W I D E R" → "Wider", "S CALING" → "Scaling"
- Convert ALL CAPS to Title Case: "SCALING LLM INFERENCE" → "Scaling LLM Inference"
- Remove excessive spacing and normalize whitespace
- Handle broken words: "I NFERENCE -T IME" → "Inference-Time"
- Use proper capitalization: first word, last word, and all major words capitalized
- Keep technical terms and acronyms correctly capitalized (LLM, AI, etc.)
- Remove strange characters or artifacts from OCR processing
- Make titles readable and professionally formatted

SPECIFIC OCR ARTIFACT EXAMPLES:
- "W IDER OR D EEPER" → "Wider or Deeper"
- "S CALING LLM I NFERENCE -T IME" → "Scaling LLM Inference-Time"
- "A DAPTIVE B RANCHING T REE S EARCH" → "Adaptive Branching Tree Search"
- "C OMPUTE WITH A DAPTIVE" → "Compute with Adaptive"

AUTHOR FORMATTING:
- Extract full names in "First Last" format
- Handle multiple authors properly: ["Kou Misaki", "Yuichi Inoue", "Yuki Imajuku"]
- Clean up OCR artifacts in names
- Remove extra spaces and normalize formatting

ABSTRACT EXTRACTION (VERY IMPORTANT):
- Look for sections labeled "Abstract", "Summary", "Executive Summary", or similar
- Extract the complete abstract text, not just the first sentence
- Clean up OCR artifacts and formatting issues
- Remove section headers like "Abstract:" or "ABSTRACT"
- Make the abstract readable and well-formatted
- If multiple abstracts exist, use the main/primary one
- Abstract should be a complete, coherent paragraph or paragraphs
- Remove any references to figures, tables, or citations within the abstract
- Typical abstract length: 100-300 words for most papers
- Look for abstract in the first 1-2 pages of the document

Extract citation metadata and return as JSON matching this schema:
${JSON.stringify(citationSchema, null, 2)}

Focus on accuracy AND proper formatting. Clean up OCR artifacts and make all text readable and professional.`;

      const userPrompt = `Extract citation metadata from this PDF content (first ${this.MAX_CONTENT_LENGTH} characters):

URL: ${url}

PDF Content:
${truncatedContent}

CRITICAL REMINDERS FOR THIS EXTRACTION:
- Fix OCR spacing: "W I D E R" → "Wider", "S CALING" → "Scaling"
- Clean up broken words: "I NFERENCE -T IME" → "Inference-Time"
- Convert ALL CAPS titles to proper Title Case
- For arXiv papers: Find actual dates like "6 Mar 2025", NEVER use arXiv ID numbers for year
- Extract clean, properly formatted author names
- Extract the complete abstract - look for "Abstract", "Summary" sections
- Remove any OCR artifacts or strange characters

EXAMPLE OF WHAT TO AVOID:
- Bad title: "W IDER OR D EEPER ? S CALING LLM I NFERENCE -T IME C OMPUTE ..."
- Good title: "Wider or Deeper? Scaling LLM Inference-Time Compute ... make sure to capture the entire title like this" (this is just an example, the title might be different)
- Make sure to capture THE ENTIRE TITLE, not just a part of it.
- Bad year: "2503" (don't extract from the arXiv ID)
- Good year: "2025" (from actual date; it'll look like "6 Mar 2025" or similar, but because of OCR might be intermingled with other text)

Return only the clean, properly formatted JSON metadata object, no explanatory text.`;

      console.log('🤖 Sending AI request for PDF citation extraction...');

      // Use GroqService to extract citation metadata
      const response = await GroqService.generateTextWithJsonParsing([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: this.MODEL,
        temperature: 0.1, // Low temperature for consistent extraction
        maxTokens: 1500,
        topP: 0.9
      });

      if (!response.success || !response.content) {
        console.error('❌ AI PDF citation extraction failed:', response.error);
        return {
          success: false,
          error: `AI extraction failed: ${response.error || 'No content generated'}`,
          extractionMethod: 'ai-pdf-content'
        };
      }

      console.log('🤖 AI response received for PDF citation extraction');

      // Get parsed JSON from response
      const aiCitations = response.parsedJson;

      if (!aiCitations) {
        console.warn('⚠️ Could not parse JSON from AI response');
        console.log('💾 Raw AI response:', response.content.substring(0, 500));
        return {
          success: false,
          error: 'Could not parse citation metadata from AI response',
          extractionMethod: 'ai-pdf-content'
        };
      }

      console.log('✅ AI extracted PDF citation metadata successfully!');
      console.log('🎯 Extracted citation data:', JSON.stringify(aiCitations, null, 2));

      // Calculate confidence based on extracted fields
      const confidence = this.calculateConfidence(aiCitations);
      console.log('📊 Extraction confidence:', confidence);

      return {
        success: true,
        citations: aiCitations,
        extractionMethod: 'ai-pdf-content',
        confidence
      };

    } catch (error) {
      console.error('❌ PDF citation extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in PDF citation extraction',
        extractionMethod: 'ai-pdf-content'
      };
    }
  }

  /**
   * Calculate confidence score based on extracted fields
   */
  private static calculateConfidence(citations: any): number {
    if (!citations || typeof citations !== 'object') return 0;

    const keyFields = ['title', 'authors', 'year'];
    const bonusFields = ['journal', 'doi', 'arxiv', 'abstract'];
    const allFields = [...keyFields, ...bonusFields];

    let score = 0;
    let maxScore = 0;

    // Key fields are weighted more heavily
    keyFields.forEach(field => {
      maxScore += 30;
      if (citations[field] && citations[field] !== '') {
        if (field === 'authors' && Array.isArray(citations[field])) {
          score += citations[field].length > 0 ? 30 : 0;
        } else {
          score += 30;
        }
      }
    });

    // Bonus fields add additional confidence
    bonusFields.forEach(field => {
      maxScore += 10;
      if (citations[field] && citations[field] !== '') {
        score += 10;
      }
    });

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Enhance existing metadata with PDF-extracted citations
   */
  static async enhanceMetadataWithPDFCitations(
    pdfContent: string,
    url: string,
    existingMetadata: PageMetadata
  ): Promise<PageMetadata> {
    try {
      console.log('📄📚 Enhancing metadata with PDF-extracted citations');

      // Extract citations from PDF content
      const pdfCitationResult = await this.extractCitationFromPDFContent(pdfContent, url, existingMetadata);

      if (!pdfCitationResult.success || !pdfCitationResult.citations) {
        console.log('⚠️ PDF citation extraction failed, returning original metadata');
        return existingMetadata;
      }

      const pdfCitations = pdfCitationResult.citations;
      console.log('🔄 Merging PDF citations with existing metadata');

      // Create enhanced metadata by merging PDF citations with existing data
      const enhancedMetadata: PageMetadata = {
        ...existingMetadata,
        // Update title if PDF extraction found a better one
        title: pdfCitations.title || existingMetadata.title,
        // ✅ NEW: Use abstract as description if available
        description: pdfCitations.abstract || existingMetadata.description,
        // ✅ NEW: Store author information at top level if available
        author: pdfCitations.authors ? pdfCitations.authors.join(', ') : existingMetadata.author,
        // Merge citation information
        citations: {
          ...existingMetadata.citations,
          // PDF-extracted fields take priority for academic papers
          title: pdfCitations.title || existingMetadata.citations?.title,
          authors: pdfCitations.authors || existingMetadata.citations?.authors,
          first_author: pdfCitations.authors?.[0] || existingMetadata.citations?.first_author,
          last_author: pdfCitations.authors?.[pdfCitations.authors.length - 1] || existingMetadata.citations?.last_author,
          year: pdfCitations.year || existingMetadata.citations?.year,
          publication_date: pdfCitations.publication_date || existingMetadata.citations?.publication_date,
          journal: pdfCitations.journal || existingMetadata.citations?.journal,
          publisher: pdfCitations.publisher || existingMetadata.citations?.publisher,
          doi: pdfCitations.doi || existingMetadata.citations?.doi,
          arxiv: pdfCitations.arxiv || existingMetadata.citations?.arxiv,
          pmid: pdfCitations.pmid || existingMetadata.citations?.pmid,
          isbn: pdfCitations.isbn || existingMetadata.citations?.isbn,
          volume: pdfCitations.volume || existingMetadata.citations?.volume,
          issue: pdfCitations.issue || existingMetadata.citations?.issue,
          pages: pdfCitations.pages || existingMetadata.citations?.pages,
          // Combine abstracts intelligently - PDF-extracted takes priority, avoid duplicates
          abstract: pdfCitations.abstract || existingMetadata.citations?.abstract,
          abstract_meta: existingMetadata.citations?.abstract_meta && existingMetadata.citations?.abstract_meta !== pdfCitations.abstract 
            ? existingMetadata.citations?.abstract_meta 
            : undefined,
          keywords: pdfCitations.keywords || existingMetadata.citations?.keywords,
          keywords_meta: pdfCitations.keywords || existingMetadata.citations?.keywords_meta,
          conference: pdfCitations.conference || existingMetadata.citations?.conference,
          type: pdfCitations.type || existingMetadata.citations?.type || 'pdf',
          // Add extraction metadata
          extractionMethod: pdfCitationResult.extractionMethod,
          extractionConfidence: pdfCitationResult.confidence,
          pdfContentExtracted: true
        }
      };

      console.log('✅ Enhanced metadata with PDF citations');
      console.log('📊 Enhanced citation fields:', Object.keys(enhancedMetadata.citations || {}));
      // ✅ NEW: Log abstract extraction
      if (pdfCitations.abstract) {
        console.log('📄 Abstract extracted and set as description:', pdfCitations.abstract.substring(0, 100) + '...');
      }

      return enhancedMetadata;

    } catch (error) {
      console.error('❌ Error enhancing metadata with PDF citations:', error);
      return existingMetadata;
    }
  }

  /**
   * Generate comprehensive citations for PDF using both content and URL analysis
   */
  static async generateComprehensivePDFCitations(
    pdfContent: string,
    url: string,
    existingMetadata?: PageMetadata
  ): Promise<CitationResult> {
    try {
      console.log('📄📚 Generating comprehensive PDF citations');

      // Step 1: Extract citations from PDF content
      const pdfCitationResult = await this.extractCitationFromPDFContent(pdfContent, url, existingMetadata);

      let enhancedMetadata = existingMetadata || {
        title: 'PDF Document',
        contentType: 'pdf',
        citations: {}
      };

      // Step 2: If PDF extraction was successful, enhance metadata
      if (pdfCitationResult.success && pdfCitationResult.citations) {
        enhancedMetadata = await this.enhanceMetadataWithPDFCitations(pdfContent, url, enhancedMetadata);
      }

      // Step 3: Use the enhanced metadata with CitationService for final citation generation
      console.log('🔄 Generating final citations using enhanced metadata');
      const finalCitationResult = await CitationService.generateCitations(enhancedMetadata, url);

      // Step 4: Add PDF-specific metadata to the result
      if (finalCitationResult.success && finalCitationResult.citations) {
        console.log('✅ Comprehensive PDF citations generated successfully');
        
        return {
          ...finalCitationResult,
          source: 'pdf-content-enhanced',
          extractionMethod: pdfCitationResult.extractionMethod,
          confidence: pdfCitationResult.confidence
        };
      } else {
        console.log('⚠️ Final citation generation failed, returning basic result');
        return finalCitationResult;
      }

    } catch (error) {
      console.error('❌ Error generating comprehensive PDF citations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating PDF citations',
        source: 'pdf-content-enhanced'
      };
    }
  }

  /**
   * Quick citation check - determine if PDF content contains academic citation info
   */
  static hasAcademicCitationInfo(pdfContent: string): boolean {
    const contentSample = pdfContent.substring(0, 2000).toLowerCase();
    
    // Check for common academic indicators
    const academicIndicators = [
      'abstract', 'doi:', 'arxiv:', 'journal', 'volume', 'issue',
      'published', 'authors', 'references', 'citation', 'pmid',
      'conference', 'proceedings', 'university', 'research'
    ];

    const foundIndicators = academicIndicators.filter(indicator => 
      contentSample.includes(indicator)
    );

    console.log('📄 Academic indicators found:', foundIndicators.length, '/', academicIndicators.length);
    return foundIndicators.length >= 3; // Require at least 3 indicators
  }

  /**
   * Extract just the essential citation fields for quick processing
   */
  static async extractEssentialCitationFields(pdfContent: string): Promise<{
    title?: string;
    authors?: string[];
    year?: string;
    doi?: string;
    arxiv?: string;
  }> {
    try {
      const truncatedContent = pdfContent.substring(0, 3000); // Shorter for quick extraction
      
      const systemPrompt = `Extract only the essential citation fields from this PDF content. Return a JSON object with only the fields you can confidently identify:

{
  "title": "string - paper title (properly formatted, fix ALL CAPS and OCR artifacts)",
  "authors": ["array", "of", "author names (clean formatting)"],
  "year": "string - publication year (YYYY)",
  "doi": "string - DOI if found",
  "arxiv": "string - arXiv ID if found"
}

FORMATTING REQUIREMENTS:
- Convert ALL CAPS titles to proper Title Case
- Fix OCR spacing artifacts (e.g., "W I D E R" → "Wider")  
- Clean up author names and remove OCR artifacts
- Make all text readable and professional

Return only the clean, properly formatted JSON object, no other text.`;

      const response = await GroqService.generateTextWithJsonParsing([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `PDF Content:\n${truncatedContent}` }
      ], {
        model: this.MODEL,
        temperature: 0.1,
        maxTokens: 500
      });

      if (response.success && response.parsedJson) {
        return response.parsedJson;
      }

      return {};
    } catch (error) {
      console.error('❌ Error extracting essential citation fields:', error);
      return {};
    }
  }
} 