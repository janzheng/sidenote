import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-csl';
import '@citation-js/plugin-doi';

// Types for citation formats
export interface CitationData {
  bibtex: string;
  apa: string;
  vancouver: string;
  harvard: string;
}

export interface CitationResult {
  success: boolean;
  citations?: CitationData;
  error?: string;
  source?: string; // 'doi' | 'url' | 'metadata'
}

export class CitationService {
  /**
   * Generate citations from a DOI
   */
  static async generateFromDOI(doi: string): Promise<CitationResult> {
    try {

      // Clean DOI (remove any prefix like "doi:" or "DOI:")
      const cleanDoi = doi.replace(/^(doi:|DOI:)\s*/i, '').trim();

      console.log(`🔍 Generating citations from DOI: ${doi} // cleanDoi: ${cleanDoi}`);
      // Create citation from DOI
      const cite = new Cite(cleanDoi);

      // Generate all citation formats with different approaches
      let citations: CitationData;

      try {
        // Get basic bibliography first
        const basicBib = cite.format('bibliography', { format: 'text', lang: 'en-US' });
        console.log('Basic bibliography:', basicBib);

        // Try different CSL styles - if they fail, create manual variations
        let apaCitation, vancouverCitation, harvardCitation;

        try {
          apaCitation = cite.format('bibliography', {
            format: 'text',
            template: 'apa',
            lang: 'en-US'
          });
        } catch {
          // Manual APA-style formatting if template fails
          apaCitation = this.formatAsAPA(cite);
        }

        try {
          vancouverCitation = cite.format('bibliography', {
            format: 'text',
            template: 'vancouver',
            lang: 'en-US'
          });
        } catch {
          // Manual Vancouver-style formatting if template fails
          vancouverCitation = this.formatAsVancouver(cite);
        }

        try {
          harvardCitation = cite.format('bibliography', {
            format: 'text',
            template: 'harvard1',
            lang: 'en-US'
          });
        } catch {
          // Manual Harvard-style formatting if template fails
          harvardCitation = this.formatAsHarvard(cite);
        }

        citations = {
          bibtex: cite.format('bibtex'),
          apa: apaCitation || basicBib,
          vancouver: vancouverCitation || basicBib,
          harvard: harvardCitation || basicBib
        };

        // Check if all citations are identical (indicating template failure)
        if (citations.apa === citations.vancouver && citations.vancouver === citations.harvard) {
          console.warn('All citation formats are identical, creating manual variations');
          citations = {
            bibtex: cite.format('bibtex'),
            apa: this.formatAsAPA(cite),
            vancouver: this.formatAsVancouver(cite),
            harvard: this.formatAsHarvard(cite)
          };
        }

      } catch (templateError) {
        // Complete fallback: use manual formatting
        console.warn('Citation formatting failed, using manual formatting:', templateError);
        citations = {
          bibtex: cite.format('bibtex'),
          apa: this.formatAsAPA(cite),
          vancouver: this.formatAsVancouver(cite),
          harvard: this.formatAsHarvard(cite)
        };
      }

      console.log(`✅ Successfully generated citations from DOI: ${cleanDoi}`);
      console.log('Citation formats generated:', Object.keys(citations));

      // Debug: Log first few characters of each citation to check differences
      Object.entries(citations).forEach(([format, citation]) => {
        console.log(`${format.toUpperCase()}: ${citation.substring(0, 100)}...`);
      });

      return {
        success: true,
        citations,
        source: 'doi'
      };

    } catch (error) {
      console.error(`❌ Error generating citations from DOI: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating citations from DOI',
        source: 'doi'
      };
    }
  }

  /**
   * Generate citations from a URL
   */
  static async generateFromURL(url: string, metadata?: any): Promise<CitationResult> {
    try {
      console.log(`🔍 Generating citations from URL: ${url}`);

      // Try to create citation from URL
      const cite = new Cite(url);

      // Generate all citation formats
      let citations: CitationData;

      try {
        citations = {
          bibtex: cite.format('bibtex'),
          apa: cite.format('bibliography', {
            format: 'text',
            template: 'apa-6th-edition',
            lang: 'en-US'
          }),
          vancouver: cite.format('bibliography', {
            format: 'text',
            template: 'vancouver',
            lang: 'en-US'
          }),
          harvard: cite.format('bibliography', {
            format: 'text',
            template: 'harvard1',
            lang: 'en-US'
          })
        };
      } catch (templateError) {
        // Fallback: use basic text formatting if templates fail
        console.warn('Template-based formatting failed, using fallback:', templateError);
        const basicFormat = cite.format('bibliography', { format: 'text', lang: 'en-US' });

        citations = {
          bibtex: cite.format('bibtex'),
          apa: basicFormat + ' (APA style formatting unavailable)',
          vancouver: basicFormat + ' (Vancouver style formatting unavailable)',
          harvard: basicFormat + ' (Harvard style formatting unavailable)'
        };
      }

      console.log(`✅ Successfully generated citations from URL: ${url}`);

      // Debug: Log first few characters of each citation to check differences
      Object.entries(citations).forEach(([format, citation]) => {
        console.log(`${format.toUpperCase()}: ${citation.substring(0, 100)}...`);
      });

      return {
        success: true,
        citations,
        source: 'url'
      };

    } catch (error) {
      // console.warn(`⚠️ Citation-js URL parsing failed: ${error instanceof Error ? error.message : error}. Citation-js is most likely not supported for this URL.`);
      // console.log('🔄 Falling back to manual URL citation formatting...');

      // Fallback: Create manual URL citations when citation-js fails
      // Pass metadata to improve the manual citation quality
      return this.generateManualURLCitation(url, metadata);
    }
  }

  /**
   * Generate manual URL citations when citation-js fails
   */
  private static generateManualURLCitation(url: string, metadata?: any): CitationResult {
    try {
      const currentDate = new Date();
      const accessDate = currentDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Extract domain for title if no other title is available
      const domain = new URL(url).hostname.replace(/^www\./, '');

      // Use comprehensive metadata for better citations - prioritize metadata over document.title
      // ✅ FIX: Use proper title hierarchy and avoid document.title which returns "SideNote" for extension pages
      const title = metadata?.title ||
        metadata?.ogTitle ||
        metadata?.twitterTitle ||
        metadata?.citationInfo?.title ||
        metadata?.citations?.title ||
        'Untitled'; // ✅ FIX: Use "Untitled" instead of document.title or domain-based fallback

      // Enhanced author extraction from multiple sources
      let author = 'Unknown Author';

      // First try citation-specific author fields
      if (metadata?.citationInfo?.authors && Array.isArray(metadata.citationInfo.authors)) {
        author = metadata.citationInfo.authors.join(', ');
      } else if (metadata?.citations?.authors && Array.isArray(metadata.citations.authors)) {
        author = metadata.citations.authors.join(', ');
      }
      // Try general author field - ✅ FIX: Check for non-empty strings
      else if (metadata?.author && metadata.author.trim() !== '') {
        author = metadata.author.trim();
      }
      // Extract author from schema.org data if not found elsewhere
      else if (metadata?.schemaData && Array.isArray(metadata.schemaData)) {
        const extractAuthorFromSchema = (schemaItems: any[]): string[] => {
          const authors: string[] = [];

          const parseJsonLdObjects = (data: any): any[] => {
            if (Array.isArray(data)) {
              return data.flatMap(parseJsonLdObjects);
            } else if (data && typeof data === 'object') {
              if (data['@graph'] && Array.isArray(data['@graph'])) {
                return data['@graph'];
              } else if (data['@type']) {
                return [data];
              }
            }
            return [];
          };

          schemaItems.forEach(schemaItem => {
            const allObjects = parseJsonLdObjects(schemaItem);

            allObjects.forEach(obj => {
              if (!obj || !obj['@type']) return;

              const objType = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];

              // Look for author in Article, NewsArticle, WebPage, etc.
              if (objType.some((type: string) => ['WebPage', 'Article', 'NewsArticle', 'BlogPost', 'ScholarlyArticle'].includes(type))) {
                if (obj.author) {
                  const extractAuthor = (author: any): string => {
                    if (typeof author === 'string') return author;
                    if (author.name) return author.name;
                    if (author['@type'] === 'Person' && author.name) return author.name;
                    return '';
                  };

                  if (Array.isArray(obj.author)) {
                    const schemaAuthors = obj.author.map(extractAuthor).filter((name: string) => name);
                    authors.push(...schemaAuthors);
                  } else {
                    const authorName = extractAuthor(obj.author);
                    if (authorName) {
                      authors.push(authorName);
                    }
                  }
                }
              }
            });
          });

          return [...new Set(authors)]; // Remove duplicates
        };

        const schemaAuthors = extractAuthorFromSchema(metadata.schemaData);
        if (schemaAuthors.length > 0) {
          author = schemaAuthors.join(', ');
          console.log(`📝 Extracted authors from schema.org data for manual citation:`, schemaAuthors);
        }
      }

      const year = metadata?.publishedDate || metadata?.citationInfo?.publication_date || metadata?.citations?.publication_date || currentDate.getFullYear();

      // Enhanced site name for better context
      const siteName = metadata?.ogSiteName || metadata?.siteName || domain;

      console.log(`📝 Manual citation using metadata:`, {
        title: title.substring(0, 50) + '...',
        author,
        year,
        siteName,
        availableFields: Object.keys(metadata || {}).length,
        rawMetadata: metadata // Include raw metadata for debugging
      });

      // Create basic citation formats
      const apa = `${author} (${year}). ${title}. ${siteName}. Retrieved ${accessDate}, from ${url}`;
      const vancouver = `${author}. ${title}. ${siteName} [Internet]. ${year} [cited ${currentDate.getFullYear()} ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}]. Available from: ${url}`;
      const harvard = `${author} (${year}) '${title}', ${siteName}, ${accessDate}. Available at: ${url}`;
      const bibtex = `@misc{${domain.replace(/\./g, '')}_${year},
  title={${title}},
  author={${author}},
  year={${year}},
  url={${url}},
  note={Accessed: ${accessDate}}
}`;

      console.log(`✅ Successfully generated manual URL citation with author: ${author}`);

      return {
        success: true,
        citations: {
          bibtex,
          apa,
          vancouver,
          harvard
        },
        source: 'manual-url'
      };

    } catch (error) {
      console.error(`❌ Error generating manual URL citation: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating manual URL citation',
        source: 'manual-url'
      };
    }
  }

  /**
   * Generate citations from metadata
   */
  static async generateFromMetadata(metadata: any): Promise<CitationResult> {
    try {
      console.log(`🔍 Generating citations from metadata`);
      console.log('📊 Received metadata:', metadata);

      // Build CSL-JSON object from metadata
      const cslJson: any = {
        type: 'webpage' // Default type
      };

      // Map metadata to CSL-JSON format - prioritize citationInfo/citations over regular fields
      const enhancedCitations = metadata.citationInfo || metadata.citations;
      console.log('🔍 Enhanced citations available:', !!enhancedCitations);
      if (enhancedCitations) {
        console.log('📊 Enhanced citation fields:', Object.keys(enhancedCitations));
        console.log('👥 Enhanced authors:', enhancedCitations.authors);
        console.log('📄 Enhanced title:', enhancedCitations.title);
      }

      // Title extraction with priority
      if (enhancedCitations?.title) {
        cslJson.title = enhancedCitations.title;
        console.log(`📄 Using enhanced title: ${enhancedCitations.title.substring(0, 60)}...`);
      } else if (metadata.title || metadata.ogTitle || metadata.twitterTitle) {
        cslJson.title = metadata.title || metadata.ogTitle || metadata.twitterTitle;
        console.log(`📄 Using fallback title: ${cslJson.title.substring(0, 60)}...`);
      } else {
        // ✅ FIX: Always provide a title, use "Untitled" as final fallback
        cslJson.title = 'Untitled';
        console.log(`📄 Using default title: Untitled`);
      }

      // Enhanced author extraction with priority for citation-specific fields
      let authorFound = false;

      // First try enhanced citation-specific author fields
      if (enhancedCitations?.authors && Array.isArray(enhancedCitations.authors)) {
        const authors = enhancedCitations.authors;
        cslJson.author = authors.map((name: string) => {
          // Try to parse "Last, First" format
          const parts = name.split(',').map((p: string) => p.trim());
          if (parts.length === 2) {
            return {
              family: parts[0],
              given: parts[1]
            };
          } else {
            // Just use the name as-is
            return { literal: name };
          }
        });
        authorFound = true;
        console.log(`👥 Using enhanced authors: ${authors.slice(0, 3).join(', ')}${authors.length > 3 ? ' et al.' : ''}`);
      }
      // Try general author field
      else if (metadata.author && metadata.author.trim() !== '') {
        cslJson.author = [{ literal: metadata.author.trim() }];
        authorFound = true;
        console.log(`👤 Using general author: ${metadata.author.trim()}`);
      }
      // Extract author from schema.org data if not found elsewhere
      else if (metadata.schemaData && Array.isArray(metadata.schemaData)) {
        const extractAuthorFromSchema = (schemaItems: any[]): string[] => {
          const authors: string[] = [];

          const parseJsonLdObjects = (data: any): any[] => {
            if (Array.isArray(data)) {
              return data.flatMap(parseJsonLdObjects);
            } else if (data && typeof data === 'object') {
              if (data['@graph'] && Array.isArray(data['@graph'])) {
                return data['@graph'];
              } else if (data['@type']) {
                return [data];
              }
            }
            return [];
          };

          schemaItems.forEach(schemaItem => {
            const allObjects = parseJsonLdObjects(schemaItem);

            allObjects.forEach(obj => {
              if (!obj || !obj['@type']) return;

              const objType = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];

              // Look for author in Article, NewsArticle, WebPage, etc.
              if (objType.some((type: string) => ['WebPage', 'Article', 'NewsArticle', 'BlogPost', 'ScholarlyArticle'].includes(type))) {
                if (obj.author) {
                  const extractAuthor = (author: any): string => {
                    if (typeof author === 'string') return author;
                    if (author.name) return author.name;
                    if (author['@type'] === 'Person' && author.name) return author.name;
                    return '';
                  };

                  if (Array.isArray(obj.author)) {
                    const schemaAuthors = obj.author.map(extractAuthor).filter((name: string) => name);
                    authors.push(...schemaAuthors);
                  } else {
                    const authorName = extractAuthor(obj.author);
                    if (authorName) {
                      authors.push(authorName);
                    }
                  }
                }
              }
            });
          });

          return [...new Set(authors)]; // Remove duplicates
        };

        const schemaAuthors = extractAuthorFromSchema(metadata.schemaData);
        if (schemaAuthors.length > 0) {
          cslJson.author = schemaAuthors.map(name => ({ literal: name }));
          authorFound = true;
          console.log(`📝 Extracted authors from schema.org data:`, schemaAuthors);
        }
      }

      // Enhanced date extraction
      if (enhancedCitations?.year || enhancedCitations?.publication_date) {
        const year = enhancedCitations.year || enhancedCitations.publication_date;
        if (year) {
          const yearNumber = parseInt(year.toString());
          if (!isNaN(yearNumber)) {
            cslJson.issued = { 'date-parts': [[yearNumber]] };
            console.log(`📅 Using enhanced year: ${yearNumber}`);
          }
        }
      } else if (metadata.publishedDate) {
        const date = new Date(metadata.publishedDate);
        if (!isNaN(date.getTime())) {
          cslJson.issued = {
            'date-parts': [[date.getFullYear(), date.getMonth() + 1, date.getDate()]]
          };
          console.log(`📅 Using published date: ${metadata.publishedDate}`);
        }
      }

      // Enhanced journal/publisher information
      if (enhancedCitations?.journal) {
        cslJson['container-title'] = enhancedCitations.journal;
        cslJson.type = 'article-journal';
        console.log(`📖 Using enhanced journal: ${enhancedCitations.journal}`);
      } else if (enhancedCitations?.publisher || metadata.publisher) {
        cslJson.publisher = enhancedCitations?.publisher || metadata.publisher;
        console.log(`🏢 Using publisher: ${cslJson.publisher}`);
      }

      // Volume, issue, pages from enhanced data
      if (enhancedCitations?.volume) {
        cslJson.volume = enhancedCitations.volume;
        console.log(`📚 Volume: ${enhancedCitations.volume}`);
      }
      if (enhancedCitations?.issue) {
        cslJson.issue = enhancedCitations.issue;
        console.log(`📑 Issue: ${enhancedCitations.issue}`);
      }
      if (enhancedCitations?.pages) {
        cslJson.page = enhancedCitations.pages;
        console.log(`📄 Pages: ${enhancedCitations.pages}`);
      }

      // URL information
      if (metadata.url || metadata.pageUrl) {
        cslJson.URL = metadata.url || metadata.pageUrl;
      }

      // Enhanced identifiers
      if (enhancedCitations?.doi) {
        cslJson.DOI = enhancedCitations.doi;
        cslJson.type = 'article-journal';
        console.log(`🔗 DOI: ${enhancedCitations.doi}`);
      }

      if (enhancedCitations?.pmid) {
        cslJson.PMID = enhancedCitations.pmid;
        cslJson.type = 'article-journal';
        console.log(`🏥 PMID: ${enhancedCitations.pmid}`);
      }

      if (enhancedCitations?.isbn) {
        cslJson.ISBN = enhancedCitations.isbn;
        cslJson.type = 'book';
        console.log(`📚 ISBN: ${enhancedCitations.isbn}`);
      }

      // arXiv handling
      if (enhancedCitations?.arxiv) {
        // For arXiv papers, set as preprint type and add arXiv info
        cslJson.type = 'article-journal';
        cslJson.publisher = 'arXiv';
        cslJson['container-title'] = 'arXiv preprint';
        cslJson.note = enhancedCitations.arxiv;
        console.log(`📚 arXiv: ${enhancedCitations.arxiv}`);
      }

      // Add accessed date for web content
      if (!cslJson.issued && cslJson.URL) {
        cslJson.accessed = {
          'date-parts': [[new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]]
        };
      }

      console.log('✅ Final CSL-JSON object:', JSON.stringify(cslJson, null, 2));

      // Create citation from CSL-JSON
      const cite = new Cite(cslJson);

      // Generate all citation formats
      let citations: CitationData;

      try {
        citations = {
          bibtex: cite.format('bibtex'),
          apa: cite.format('bibliography', {
            format: 'text',
            template: 'apa-6th-edition',
            lang: 'en-US'
          }),
          vancouver: cite.format('bibliography', {
            format: 'text',
            template: 'vancouver',
            lang: 'en-US'
          }),
          harvard: cite.format('bibliography', {
            format: 'text',
            template: 'harvard1',
            lang: 'en-US'
          })
        };
      } catch (templateError) {
        // Fallback: use basic text formatting if templates fail
        console.warn('Template-based formatting failed, using fallback:', templateError);
        const basicFormat = cite.format('bibliography', { format: 'text', lang: 'en-US' });

        citations = {
          bibtex: cite.format('bibtex'),
          apa: basicFormat + ' (APA style formatting unavailable)',
          vancouver: basicFormat + ' (Vancouver style formatting unavailable)',
          harvard: basicFormat + ' (Harvard style formatting unavailable)'
        };
      }

      console.log(`✅ Successfully generated citations from metadata`);

      // Debug: Log citation previews to verify enhanced data is being used
      console.log('📝 Generated citation previews:');
      Object.entries(citations).forEach(([format, citation]) => {
        console.log(`${format.toUpperCase()}: ${citation.substring(0, 120)}...`);
      });

      return {
        success: true,
        citations,
        source: 'metadata'
      };

    } catch (error) {
      console.error(`❌ Error generating citations from metadata: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating citations from metadata',
        source: 'metadata'
      };
    }
  }

  /**
   * Generate citations using the best available method
   * Priority: DOI > URL > Metadata > AI-Generated
   */
  static async generateCitations(metadata: any, url?: string): Promise<CitationResult> {
    try {
      console.log('🚀 Starting citation generation pipeline...');
      console.log('📊 Metadata received:', metadata);
      console.log('🔗 URL:', url);
      console.log('📋 Available metadata keys:', Object.keys(metadata || {}));

      if (!metadata || Object.keys(metadata).length === 0) {
        console.warn('⚠️ No metadata provided to citation service!');
      }

      // Check for DOI in multiple places
      const doi = metadata?.citations?.doi || metadata?.citationInfo?.doi;
      if (doi) {
        console.log(`🎯 Found DOI, attempting DOI-based citation generation: ${doi}`);
        const doiResult = await this.generateFromDOI(doi);
        if (doiResult.success) {
          return doiResult;
        }
        console.log(`⚠️ DOI citation failed, falling back to other methods`);
      }

      // Try URL if DOI failed or not available - pass metadata for better URL citations
      if (url) {
        console.log(`🎯 Attempting URL-based citation generation with metadata: ${url}`);
        console.log('🔍 Metadata being passed to URL citation:', {
          title: metadata?.title || metadata?.ogTitle || 'No title',
          author: metadata?.author || 'No author',
          hasMetadata: !!metadata && Object.keys(metadata).length > 0
        });
        const urlResult = await this.generateFromURL(url, metadata);
        if (urlResult.success) {
          return urlResult;
        }
        console.log(`⚠️ URL citation failed, falling back to metadata`);
      }

      // Fall back to metadata-based generation
      console.log(`🎯 Attempting metadata-based citation generation`);
      const metadataResult = await this.generateFromMetadata({ ...metadata, pageUrl: url });
      if (metadataResult.success) {
        return metadataResult;
      }
      console.log(`⚠️ Metadata citation failed, falling back to AI generation`);

      // Final fallback: AI-generated citations
      console.log(`🤖 Attempting AI-generated citation as last resort`);
      return await this.generateWithAI(metadata, url);

    } catch (error) {
      console.error(`❌ Error in citation generation pipeline: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in citation generation pipeline'
      };
    }
  }

  /**
   * Generate citations using AI as a last resort fallback
   * Uses the cheap llama-3.1-8b-instant model to extract citation metadata from HTML
   */
  static async generateWithAI(metadata: any, url?: string): Promise<CitationResult> {
    console.log('🤖 Starting AI-powered citation generation as fallback...');

    try {
      // Import the groqService functions
      const { generateText } = await import('./groqService.svelte');

      // Prepare the content for AI analysis
      let htmlContent = '';
      let pageTitle = '';

      // Try to get HTML content from the page
      if (typeof document !== 'undefined') {
        // Get a cleaned version of the HTML - focus on header and content areas
        const titleElement = document.querySelector('title');
        pageTitle = titleElement?.textContent || '';

        // Extract key elements that might contain citation info
        const headContent = document.head?.innerHTML || '';
        const mainContent = document.querySelector('main')?.innerHTML ||
          document.querySelector('article')?.innerHTML ||
          document.querySelector('.content')?.innerHTML ||
          document.querySelector('#content')?.innerHTML ||
          document.body?.innerHTML?.substring(0, 10000) || ''; // Limit to first 10k chars

        htmlContent = `<head>${headContent}</head><body>${mainContent}</body>`;
      }

      // Create the metadata schema for the AI
      const metadataSchema = {
        title: "string - The main title of the article/page",
        author: "string - The author(s) name(s), comma-separated if multiple",
        publishedDate: "string - Publication date in YYYY-MM-DD format or year",
        description: "string - Brief description or abstract",
        publisher: "string - The publishing organization or website name",
        journal: "string - Journal name (if academic paper)",
        doi: "string - DOI identifier (if available)",
        pmid: "string - PubMed ID (if available)",
        arxiv: "string - arXiv ID (if available)",
        isbn: "string - ISBN (if book)",
        volume: "string - Journal volume (if applicable)",
        issue: "string - Journal issue (if applicable)",
        pages: "string - Page numbers (if applicable)",
        url: "string - The URL of the page"
      };

      // Create the AI prompt with enhanced author detection
      const systemPrompt = `You are an expert metadata extractor specializing in distinguishing between AUTHORS and PUBLISHERS. Your job is to analyze HTML content and extract citation metadata for academic and web citations.

CRITICAL: For the "author" field, prioritize INDIVIDUAL PERSON NAMES over organization/site names:
- Look for author bylines in article content like "By [Name]", "Author: [Name]", or author bio sections
- Prefer person names found in visible article text over site/publisher names
- Common patterns: "By Andy Greenberg", "Written by John Smith", "Author: Jane Doe"
- AVOID using organization names (like "WIRED", "Ars Technica", "New York Times") as authors
- Use those organization names for the "publisher" field instead

Extract citation metadata from the provided HTML content and return it as a clean JSON object. Look for:
- Meta tags (citation_author, dc.Creator, og:*, twitter:*)
- Schema.org JSON-LD data with Person objects
- Visible text content for author bylines and bio information
- Publication dates in meta tags or visible content
- Any academic identifiers (DOI, PMID, arXiv, etc.)

For author extraction specifically:
1. First check citation_author meta tags
2. Then check schema.org Person objects  
3. Then scan visible content for author bylines
4. Only use publisher/site name if no individual author is found

Return ONLY a JSON object with the metadata schema provided. If a field cannot be determined, omit it from the JSON. Do not include any explanatory text.

Metadata Schema:
${JSON.stringify(metadataSchema, null, 2)}`;

      const userPrompt = `Extract citation metadata from this HTML content:

URL: ${url || 'Unknown URL'}
Page Title: ${pageTitle}

HTML Content:
${htmlContent}

IMPORTANT: Focus on finding the actual AUTHOR (person's name) not the publisher/site name. Look for bylines like "By [Name]" in the article content.

Return only the JSON metadata object, no other text.`;

      console.log('🤖 Sending AI request for citation extraction...');
      console.log('📄 Content being analyzed:', {
        url: url || 'Unknown URL',
        pageTitle: pageTitle,
        htmlContentLength: htmlContent.length,
        hasHeadContent: htmlContent.includes('<head>'),
        hasBodyContent: htmlContent.includes('<body>')
      });

      // Use generateText with the cheap model
      const response = await generateText([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: 'llama-3.1-8b-instant',
        temperature: 0.1, // Low temperature for more consistent extraction
        maxTokens: 1000,
        topP: 0.9
      });

      if (!response.success || !response.content) {
        console.error('❌ AI citation extraction error:', response.error);
        console.log('🔍 Request details that failed:', {
          model: 'llama-3.1-8b-instant',
          promptLength: systemPrompt.length + userPrompt.length,
          hasContent: !!htmlContent
        });
        return {
          success: false,
          error: `AI extraction failed: ${response.error || 'No content generated'}`,
          source: 'ai'
        };
      }

      console.log('🤖 AI response received, parsing JSON...');
      console.log('📝 Raw AI response preview:', response.content.substring(0, 300) + '...');

      // Extract JSON from the AI response
      const { extractJsonFromResponse } = await import('../utils/extractJsonFromResponse');
      const aiMetadata = extractJsonFromResponse(response.content);

      if (!aiMetadata) {
        console.warn('⚠️ Could not parse JSON from AI response');
        console.log('💾 Full AI response that failed to parse:', response.content);
        return {
          success: false,
          error: 'Could not parse citation metadata from AI response',
          source: 'ai'
        };
      }

      console.log('✅ AI extracted metadata successfully!');
      console.log('🎯 Extracted JSON metadata:', JSON.stringify(aiMetadata, null, 2));

      // Log specific author detection results
      if (aiMetadata.author) {
        console.log('👤 Author detected:', aiMetadata.author);
        console.log('✓ Author type check:', {
          isPersonName: !aiMetadata.author.toLowerCase().includes('wired') &&
            !aiMetadata.author.toLowerCase().includes('ars technica') &&
            !aiMetadata.author.toLowerCase().includes('new york times'),
          authorValue: aiMetadata.author
        });
      } else {
        console.log('⚠️ No author detected in AI extraction');
      }

      if (aiMetadata.publisher) {
        console.log('🏢 Publisher detected:', aiMetadata.publisher);
      }

      // Merge AI-extracted metadata with existing metadata, prioritizing existing data
      const enhancedMetadata = {
        ...aiMetadata,
        ...metadata, // Existing metadata takes priority
        url: url || aiMetadata.url || metadata.url
      };

      console.log('🔀 Merging AI metadata with existing metadata...');
      console.log('📊 Merged metadata:', JSON.stringify(enhancedMetadata, null, 2));
      console.log('🔍 Metadata merge summary:', {
        fieldsFromAI: Object.keys(aiMetadata).length,
        fieldsFromExisting: Object.keys(metadata || {}).length,
        totalFieldsAfterMerge: Object.keys(enhancedMetadata).length,
        finalAuthor: enhancedMetadata.author || 'No author',
        finalPublisher: enhancedMetadata.publisher || 'No publisher',
        finalTitle: enhancedMetadata.title || 'No title'
      });

      console.log('🤖 Generating citations from AI-enhanced metadata...');

      // Use the enhanced metadata to generate citations via the standard metadata method
      const citationResult = await this.generateFromMetadata(enhancedMetadata);

      if (citationResult.success) {
        console.log('✅ AI-powered citation generation successful!');
        console.log('📚 Generated citation formats:', Object.keys(citationResult.citations || {}));
        console.log('🎯 APA citation preview:', citationResult.citations?.apa?.substring(0, 150) + '...');
        return {
          ...citationResult,
          source: 'ai'
        };
      } else {
        console.warn('⚠️ Citation generation failed even with AI-enhanced metadata');
        console.log('❌ Citation generation error details:', citationResult.error);
        console.log('🔍 Metadata that failed citation generation:', enhancedMetadata);
        return citationResult;
      }

    } catch (error) {
      console.error('❌ AI citation generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in AI citation generation',
        source: 'ai'
      };
    }
  }

  /**
   * Clean and format citation text
   */
  static cleanCitation(citation: string): string {
    return citation
      .replace(/\n\s*\n/g, '\n') // Remove extra line breaks
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Manual APA formatting as fallback
   */
  private static formatAsAPA(cite: any): string {
    try {
      const data = cite.data[0];
      if (!data) return 'Citation data unavailable';

      const authors = this.formatAuthorsAPA(data.author);
      const year = data.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
      const title = data.title || 'Untitled';
      const journal = data['container-title'];
      const url = data.URL;

      if (journal) {
        // Journal article format
        return `${authors} (${year}). ${title}. *${journal}*. ${url ? `Retrieved from ${url}` : ''}`.trim();
      } else {
        // Web page format
        return `${authors} (${year}). *${title}*. ${url ? `Retrieved from ${url}` : ''}`.trim();
      }
    } catch (error) {
      return 'APA citation format unavailable';
    }
  }

  /**
   * Manual Vancouver formatting as fallback
   */
  private static formatAsVancouver(cite: any): string {
    try {
      const data = cite.data[0];
      if (!data) return 'Citation data unavailable';

      const authors = this.formatAuthorsVancouver(data.author);
      const title = data.title || 'Untitled';
      const journal = data['container-title'];
      const year = data.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
      const volume = data.volume;
      const issue = data.issue;
      const pages = data.page;
      const url = data.URL;

      if (journal) {
        // Journal article format: Authors. Title. Journal. Year;volume(issue):pages.
        let citation = `${authors} ${title}. ${journal}. ${year}`;
        if (volume) citation += `;${volume}`;
        if (issue) citation += `(${issue})`;
        if (pages) citation += `:${pages}`;
        citation += '.';
        if (url) citation += ` Available from: ${url}`;
        return citation;
      } else {
        // Web page format: Authors. Title [Internet]. Year [cited date]. Available from: URL
        return `${authors} ${title} [Internet]. ${year} [cited ${new Date().toLocaleDateString()}]. Available from: ${url || 'URL not available'}`;
      }
    } catch (error) {
      return 'Vancouver citation format unavailable';
    }
  }

  /**
   * Manual Harvard formatting as fallback
   */
  private static formatAsHarvard(cite: any): string {
    try {
      const data = cite.data[0];
      if (!data) return 'Citation data unavailable';

      const authors = this.formatAuthorsHarvard(data.author);
      const year = data.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
      const title = data.title || 'Untitled';
      const journal = data['container-title'];
      const volume = data.volume;
      const issue = data.issue;
      const pages = data.page;
      const url = data.URL;

      if (journal) {
        // Journal article format: Authors (Year). 'Title'. Journal, Volume(Issue), pp. pages.
        let citation = `${authors} (${year}). '${title}'. ${journal}`;
        if (volume) {
          citation += `, ${volume}`;
          if (issue) citation += `(${issue})`;
        }
        if (pages) citation += `, pp. ${pages}`;
        citation += '.';
        if (url) citation += ` Available at: ${url} (Accessed: ${new Date().toLocaleDateString()}).`;
        return citation;
      } else {
        // Web page format: Authors (Year). Title. [Online] Available at: URL (Accessed: date).
        return `${authors} (${year}). ${title}. [Online] Available at: ${url || 'URL not available'} (Accessed: ${new Date().toLocaleDateString()}).`;
      }
    } catch (error) {
      return 'Harvard citation format unavailable';
    }
  }

  /**
   * Format authors for APA style
   */
  private static formatAuthorsAPA(authors: any[]): string {
    if (!authors || authors.length === 0) return 'Unknown Author';

    const authorNames = authors.map(author => {
      if (typeof author === 'string') return author;
      if (author.literal) return author.literal;
      if (author.family && author.given) {
        return `${author.family}, ${author.given.charAt(0)}.`;
      }
      return author.family || author.given || 'Unknown';
    });

    if (authorNames.length === 1) return authorNames[0];
    if (authorNames.length === 2) return `${authorNames[0]} & ${authorNames[1]}`;
    return `${authorNames.slice(0, -1).join(', ')}, & ${authorNames[authorNames.length - 1]}`;
  }

  /**
   * Format authors for Vancouver style
   */
  private static formatAuthorsVancouver(authors: any[]): string {
    if (!authors || authors.length === 0) return 'Unknown Author.';

    const authorNames = authors.map(author => {
      if (typeof author === 'string') return author;
      if (author.literal) return author.literal;
      if (author.family && author.given) {
        // Vancouver style: Family Given Initial(s). (e.g., Smith JA.)
        const initials = author.given.split(' ').map((name: string) => name.charAt(0)).join('');
        return `${author.family} ${initials}`;
      }
      return author.family || author.given || 'Unknown';
    });

    // Vancouver style uses commas between all authors
    if (authorNames.length === 1) return `${authorNames[0]}.`;
    if (authorNames.length <= 6) {
      return `${authorNames.join(', ')}.`;
    } else {
      // If more than 6 authors, list first 6 followed by "et al."
      return `${authorNames.slice(0, 6).join(', ')}, et al.`;
    }
  }

  /**
   * Format authors for Harvard style
   */
  private static formatAuthorsHarvard(authors: any[]): string {
    if (!authors || authors.length === 0) return 'Unknown Author';

    const authorNames = authors.map((author, index) => {
      if (typeof author === 'string') return author;
      if (author.literal) return author.literal;
      if (author.family && author.given) {
        // First author: Family, Given Initial(s)
        if (index === 0) {
          const initials = author.given.split(' ').map((name: string) => name.charAt(0) + '.').join(' ');
          return `${author.family}, ${initials}`;
        }
        // Subsequent authors: Given Initial(s) Family
        const initials = author.given.split(' ').map((name: string) => name.charAt(0) + '.').join(' ');
        return `${initials} ${author.family}`;
      }
      return author.family || author.given || 'Unknown';
    });

    if (authorNames.length === 1) return authorNames[0];
    if (authorNames.length === 2) return `${authorNames[0]} and ${authorNames[1]}`;
    if (authorNames.length <= 3) {
      return `${authorNames.slice(0, -1).join(', ')} and ${authorNames[authorNames.length - 1]}`;
    } else {
      // Harvard style: if more than 3 authors, use "et al." after first author
      return `${authorNames[0]} et al.`;
    }
  }

  /**
   * Generate citations directly from enhanced citation metadata
   * This is used when we have comprehensive citation info extracted by LLM
   */
  static generateFromEnhancedMetadata(enhancedCitations: any, url?: string): CitationResult {
    try {
      console.log('🎯 Generating citations directly from enhanced metadata');
      console.log('📊 Enhanced metadata:', enhancedCitations);

      // Extract data for manual citation formatting
      const title = enhancedCitations.title || 'Untitled';
      const authors = enhancedCitations.authors || [];
      const year = enhancedCitations.year || enhancedCitations.publication_date?.substring(0, 4) || new Date().getFullYear();
      const journal = enhancedCitations.journal;
      const doi = enhancedCitations.doi;
      const arxiv = enhancedCitations.arxiv;
      const volume = enhancedCitations.volume;
      const issue = enhancedCitations.issue;
      const pages = enhancedCitations.pages;
      const publisher = enhancedCitations.publisher;
      const pmid = enhancedCitations.pmid;

      // Format authors for different styles
      const authorString = authors.length > 0 ? authors.join(', ') : 'Unknown Author';
      const firstAuthor = authors.length > 0 ? authors[0] : 'Unknown Author';
      const lastAuthor = authors.length > 1 ? authors[authors.length - 1] : firstAuthor;
      const correspondence = enhancedCitations.correspondence;

      // Create manual citations with enhanced data
      let bibtex = '';
      let apa = '';
      let vancouver = '';
      let harvard = '';

      // BibTeX format
      const bibKey = `${firstAuthor.replace(/\s+/g, '').toLowerCase()}_${year}`;
      bibtex = `@article{${bibKey},
  title={${title}},
  author={${authorString}},
  year={${year}}`;

      if (journal) bibtex += `,\n  journal={${journal}}`;
      if (volume) bibtex += `,\n  volume={${volume}}`;
      if (issue) bibtex += `,\n  number={${issue}}`;
      if (pages) bibtex += `,\n  pages={${pages}}`;
      if (doi) bibtex += `,\n  doi={${doi}}`;
      if (arxiv) bibtex += `,\n  note={${arxiv}}`;
      if (correspondence) bibtex += `,\n  correspondence={${correspondence}}`;
      if (url) bibtex += `,\n  url={${url}}`;
      bibtex += '\n}';

      // APA format
      if (journal) {
        // Journal article
        apa = `${authorString} (${year}). ${title}. *${journal}*`;
        if (volume) {
          apa += `, *${volume}*`;
          if (issue) apa += `(${issue})`;
        }
        if (pages) apa += `, ${pages}`;
        apa += '.';
        if (doi) apa += ` https://doi.org/${doi}`;
        else if (url) apa += ` Retrieved from ${url}`;
      } else if (arxiv) {
        // arXiv preprint
        apa = `${authorString} (${year}). *${title}* [Preprint]. arXiv. ${arxiv}`;
        if (url) apa += ` Retrieved from ${url}`;
      } else {
        // Web page/other
        apa = `${authorString} (${year}). *${title}*`;
        if (publisher) apa += `. ${publisher}`;
        if (url) apa += `. Retrieved from ${url}`;
      }

      // Vancouver format
      if (journal) {
        // Journal article
        vancouver = `${authorString}. ${title}. ${journal}. ${year}`;
        if (volume) {
          vancouver += `;${volume}`;
          if (issue) vancouver += `(${issue})`;
        }
        if (pages) vancouver += `:${pages}`;
        vancouver += '.';
        if (doi) vancouver += ` doi:${doi}`;
        else if (pmid) vancouver += ` PMID: ${pmid}`;
      } else if (arxiv) {
        // arXiv preprint
        vancouver = `${authorString}. ${title} [Preprint]. arXiv; ${year}. ${arxiv}`;
        if (url) vancouver += ` Available from: ${url}`;
      } else {
        // Web page/other
        vancouver = `${authorString}. ${title} [Internet]`;
        if (publisher) vancouver += `. ${publisher}`;
        vancouver += `; ${year}`;
        if (url) vancouver += ` [cited ${new Date().toLocaleDateString()}]. Available from: ${url}`;
      }

      // Harvard format
      if (journal) {
        // Journal article
        harvard = `${authorString} (${year}) '${title}', *${journal}*`;
        if (volume) {
          harvard += `, vol. ${volume}`;
          if (issue) harvard += `, no. ${issue}`;
        }
        if (pages) harvard += `, pp. ${pages}`;
        harvard += '.';
        if (doi) harvard += ` doi: ${doi}`;
      } else if (arxiv) {
        // arXiv preprint
        harvard = `${authorString} (${year}) '${title}', *arXiv preprint*, ${arxiv}`;
        if (url) harvard += `. Available at: ${url}`;
      } else {
        // Web page/other
        harvard = `${authorString} (${year}) '${title}'`;
        if (publisher) harvard += `, *${publisher}*`;
        if (url) harvard += `. Available at: ${url} (Accessed: ${new Date().toLocaleDateString()})`;
      }

      const citations: CitationData = {
        bibtex,
        apa,
        vancouver,
        harvard
      };

      console.log('✅ Successfully generated enhanced citations');
      console.log('📝 Enhanced citation previews:');
      Object.entries(citations).forEach(([format, citation]) => {
        console.log(`${format.toUpperCase()}: ${citation.substring(0, 120)}...`);
      });

      return {
        success: true,
        citations,
        source: 'enhanced-metadata'
      };

    } catch (error) {
      console.error('❌ Error generating citations from enhanced metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating enhanced citations',
        source: 'enhanced-metadata'
      };
    }
  }
} 