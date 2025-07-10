import type { PageMetadata } from '../../types/pageMetadata';

/**
 * Extract comprehensive metadata from HTML document
 * This function should be called within a content script context where document is available
 */
export function extractMetadata(): PageMetadata {
  console.log('🔍 Extracting comprehensive metadata from HTML document');
  const metadata: PageMetadata = {};
  
  // Extract title from <title> tag first (highest priority)
  const titleElement = document.querySelector('title');
  if (titleElement && titleElement.textContent) {
    metadata.title = titleElement.textContent.trim();
  }
  
  // Extract description from meta description tag (high priority)
  const descriptionMeta = document.querySelector('meta[name="description"], meta[property="description"]');
  if (descriptionMeta) {
    const descriptionContent = descriptionMeta.getAttribute('content');
    if (descriptionContent) {
      metadata.description = descriptionContent.trim();
    }
  }
  
  // HTML Meta tags - comprehensive extraction
  const metaTags = document.querySelectorAll('meta');
  metaTags.forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv');
    const content = meta.getAttribute('content');
    
    if (!name || !content) return;
    
    const nameLower = name.toLowerCase();
    
    // Basic HTML meta tags
    switch (nameLower) {
      case 'description':
        if (!metadata.description) metadata.description = content;
        break;
      case 'keywords':
        metadata.keywords = content;
        break;
      case 'author':
        metadata.author = content;
        break;
      case 'publisher':
        metadata.publisher = content;
        break;
      case 'date':
      case 'article:published_time':
      case 'publication_date':
        metadata.publishedDate = content;
        break;
      case 'last-modified':
      case 'article:modified_time':
        metadata.modifiedDate = content;
        break;
      case 'language':
      case 'content-language':
        metadata.language = content;
        break;
      case 'viewport':
        metadata.viewport = content;
        break;
      case 'robots':
        metadata.robots = content;
        break;
      
      // Open Graph
      case 'og:title':
        metadata.ogTitle = content;
        break;
      case 'og:description':
        metadata.ogDescription = content;
        break;
      case 'og:image':
      case 'og:image:secure_url':
        metadata.ogImage = content;
        break;
      case 'og:type':
        metadata.ogType = content;
        break;
      case 'og:site_name':
        metadata.ogSiteName = content;
        break;
      
      // Twitter Card
      case 'twitter:card':
        metadata.twitterCard = content;
        break;
      case 'twitter:title':
        metadata.twitterTitle = content;
        break;
      case 'twitter:description':
        metadata.twitterDescription = content;
        break;
      case 'twitter:image':
        metadata.twitterImage = content;
        break;
    }
  });

  // Charset
  const charsetMeta = document.querySelector('meta[charset]');
  if (charsetMeta) {
    metadata.charset = charsetMeta.getAttribute('charset') || undefined;
  }

  // Canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    metadata.canonical = canonical.getAttribute('href') || undefined;
  }

  // Extract headings
  const headings: { h1?: string[], h2?: string[], h3?: string[] } = {};
  ['h1', 'h2', 'h3'].forEach(tag => {
    const elements = document.querySelectorAll(tag);
    if (elements.length > 0) {
      headings[tag as keyof typeof headings] = Array.from(elements).map(el => el.textContent?.trim() || '').filter(text => text);
    }
  });
  if (Object.keys(headings).length > 0) {
    metadata.headings = headings;
  }

  // Extract image information with deduplication
  const images = document.querySelectorAll('img');
  if (images.length > 0) {
    const seenUrls = new Set<string>();
    const imageData = Array.from(images)
      .map(img => {
        let url = img.src || img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        
        // Normalize URL to handle relative URLs and remove fragments
        if (url) {
          try {
            const normalizedUrl = new URL(url, window.location.href);
            // Remove hash fragments and normalize
            normalizedUrl.hash = '';
            url = normalizedUrl.toString();
          } catch {
            // If URL parsing fails, keep original but trim whitespace
            url = url.trim();
          }
        }
        
        return { url, alt, width, height };
      })
      .filter(item => {
        // Only include images with URLs
        if (!item.url) return false;
        
        // Skip very small images (likely icons/decorative elements)
        if (item.width > 0 && item.height > 0 && (item.width < 32 || item.height < 32)) {
          return false;
        }
        
        // Skip common UI element patterns
        const commonPatterns = [
          /vote|arrow|icon|bullet|dot|star|thumb/i,
          /logo.*small|small.*logo/i,
          /\d+x\d+\.(?:png|gif|svg)$/i, // Small dimension images
          /spacer|pixel|blank|transparent/i,
          /s\.gif$/i, // Skip HN's spacer gif specifically
          /grayarrow\.gif$/i, // Skip HN's arrow gifs
        ];
        
        const urlLower = item.url.toLowerCase();
        const altLower = item.alt.toLowerCase();
        
        if (commonPatterns.some(pattern => 
          pattern.test(urlLower) || pattern.test(altLower)
        )) {
          return false;
        }
        
        // Deduplicate by normalized URL
        if (seenUrls.has(item.url)) {
          return false;
        }
        
        seenUrls.add(item.url);
        return true;
      })
      .map(({ url, alt }) => ({ url, alt })); // Remove width/height from final output
    
    metadata.images = {
      count: images.length, // Total count before deduplication
      uniqueCount: imageData.length, // Count after deduplication
      items: imageData
    };
  }

  // Extract link information
  const allLinks = document.querySelectorAll('a[href]');
  const currentDomain = window.location.hostname;
  let internal = 0, external = 0;

  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      try {
        const url = new URL(href, window.location.href);
        if (url.hostname === currentDomain) {
          internal++;
        } else {
          external++;
        }
      } catch {
        // Relative or malformed URL, count as internal
        internal++;
      }
    }
  });

  if (internal > 0 || external > 0) {
    metadata.links = { internal, external };
  }

  // Extract JSON-LD Schema.org data
  extractJsonLdMetadata(metadata);

  // Extract academic/citation metadata
  extractCitationMetadata(metadata);

  console.log('🔍 Comprehensive metadata extraction complete:', {
    title: metadata.title,
    hasSchemaData: !!metadata.schemaData,
    hasCitations: !!metadata.citations,
    imageCount: metadata.images?.count,
    linkCount: (metadata.links?.internal || 0) + (metadata.links?.external || 0)
  });

  return metadata;
}

/**
 * Extract JSON-LD Schema.org metadata
 */
function extractJsonLdMetadata(metadata: PageMetadata) {
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  if (jsonLdScripts.length > 0) {
    try {
      const schemaData = Array.from(jsonLdScripts).map(script => {
        try {
          return JSON.parse(script.textContent || '');
        } catch {
          return null;
        }
      }).filter(data => data);

      if (schemaData.length > 0) {
        metadata.schemaData = schemaData;
        
        // Enhanced JSON-LD parsing for specific metadata extraction
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

        const allObjects = schemaData.flatMap(parseJsonLdObjects);
        
        // Extract schema type from first valid schema
        const firstSchema = allObjects[0];
        if (firstSchema && firstSchema['@type']) {
          metadata.schemaType = Array.isArray(firstSchema['@type']) 
            ? firstSchema['@type'].join(', ') 
            : firstSchema['@type'];
        }

        // Extract specific metadata from different schema types
        allObjects.forEach(obj => {
          if (!obj || !obj['@type']) return;
          
          const objType = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
          
          // WebPage, Article, NewsArticle, BlogPost, etc.
          if (objType.some((type: string) => ['WebPage', 'Article', 'NewsArticle', 'BlogPost', 'ScholarlyArticle'].includes(type))) {
            // Extract description if not already set
            if (obj.description && !metadata.description) {
              metadata.description = obj.description;
            }
            
            // Extract author information
            if (obj.author) {
              const extractAuthor = (author: any): string => {
                if (typeof author === 'string') return author;
                if (author.name) return author.name;
                if (author['@type'] === 'Person' && author.name) return author.name;
                return '';
              };
              
              if (Array.isArray(obj.author)) {
                const authors = obj.author.map(extractAuthor).filter((name: string) => name);
                if (authors.length > 0 && !metadata.author) {
                  metadata.author = authors.join(', ');
                }
              } else {
                const authorName = extractAuthor(obj.author);
                if (authorName && !metadata.author) {
                  metadata.author = authorName;
                }
              }
            }
            
            // Extract publication/modification dates
            if (obj.datePublished && !metadata.publishedDate) {
              metadata.publishedDate = obj.datePublished;
            }
            if (obj.dateModified && !metadata.modifiedDate) {
              metadata.modifiedDate = obj.dateModified;
            }
            
            // Extract publisher information
            if (obj.publisher && !metadata.publisher) {
              if (typeof obj.publisher === 'string') {
                metadata.publisher = obj.publisher;
              } else if (obj.publisher.name) {
                metadata.publisher = obj.publisher.name;
              }
            }
            
            // Extract breadcrumbs
            if (obj.breadcrumb && obj.breadcrumb['@type'] === 'BreadcrumbList' && obj.breadcrumb.itemListElement) {
              // Ensure itemListElement is treated as an array
              const itemListElement = Array.isArray(obj.breadcrumb.itemListElement) 
                ? obj.breadcrumb.itemListElement 
                : [obj.breadcrumb.itemListElement];
              
              const breadcrumbs = itemListElement
                .map((item: any) => item.name || (item.item && typeof item.item === 'string' ? item.item : ''))
                .filter((name: string) => name);
              if (breadcrumbs.length > 0) {
                metadata.breadcrumbs = breadcrumbs;
              }
            }
            
            // Extract keywords
            if (obj.keywords && !metadata.keywords) {
              if (Array.isArray(obj.keywords)) {
                metadata.keywords = obj.keywords.join(', ');
              } else if (typeof obj.keywords === 'string') {
                metadata.keywords = obj.keywords;
              }
            }
            
            // Extract language
            if (obj.inLanguage && !metadata.language) {
              metadata.language = obj.inLanguage;
            }
          }
          
          // WebSite schema
          if (objType.includes('WebSite')) {
            if (obj.name && !metadata.siteName) {
              metadata.siteName = obj.name;
            }
            if (obj.description && !metadata.siteDescription) {
              metadata.siteDescription = obj.description;
            }
            if (obj.publisher && !metadata.publisher) {
              if (typeof obj.publisher === 'string') {
                metadata.publisher = obj.publisher;
              } else if (obj.publisher.name) {
                metadata.publisher = obj.publisher.name;
              }
            }
          }
          
          // Organization schema
          if (objType.includes('Organization')) {
            if (obj.name && !metadata.organizationName) {
              metadata.organizationName = obj.name;
            }
            if (obj.logo && obj.logo.url && !metadata.organizationLogo) {
              metadata.organizationLogo = obj.logo.url || obj.logo.contentUrl;
            }
          }
          
          // Person schema
          if (objType.includes('Person')) {
            if (obj.name && !metadata.personName) {
              metadata.personName = obj.name;
            }
            if (obj.description && !metadata.personDescription) {
              metadata.personDescription = obj.description;
            }
          }
          
          // Product schema
          if (objType.includes('Product')) {
            if (obj.name && !metadata.productName) {
              metadata.productName = obj.name;
            }
            if (obj.description && !metadata.productDescription) {
              metadata.productDescription = obj.description;
            }
            if (obj.brand && !metadata.productBrand) {
              metadata.productBrand = typeof obj.brand === 'string' ? obj.brand : obj.brand.name;
            }
            if (obj.offers && obj.offers.price && !metadata.productPrice) {
              metadata.productPrice = obj.offers.price;
            }
          }
          
          // Video/Audio schema
          if (objType.some((type: string) => ['VideoObject', 'AudioObject'].includes(type))) {
            if (obj.name && !metadata.mediaTitle) {
              metadata.mediaTitle = obj.name;
            }
            if (obj.description && !metadata.mediaDescription) {
              metadata.mediaDescription = obj.description;
            }
            if (obj.duration && !metadata.mediaDuration) {
              metadata.mediaDuration = obj.duration;
            }
            if (obj.uploadDate && !metadata.mediaUploadDate) {
              metadata.mediaUploadDate = obj.uploadDate;
            }
          }
        });
      }
    } catch (error) {
      console.warn('Error parsing JSON-LD schema data:', error);
    }
  }

  console.log('🔍 Extracted JSON-LD schemas:', jsonLdScripts.length);
}

/**
 * Extract academic/citation metadata
 */
function extractCitationMetadata(metadata: PageMetadata) {
  const citations: any = {};

  // Citation meta tags - comprehensive list
  const citationSelectors = [
    // DOI - Enhanced to better catch dc.identifier with DOI content
    { selector: 'meta[name="citation_doi"], meta[name="DC.identifier"], meta[name="dc.identifier"], meta[property="citation_doi"], meta[name="dc.Identifier"][content*="10."], meta[name="DC.Identifier"][content*="10."]', field: 'doi' },
    // PMID
    { selector: 'meta[name="citation_pmid"], meta[property="citation_pmid"]', field: 'pmid' },
    // PMCID
    { selector: 'meta[name="citation_pmcid"], meta[property="citation_pmcid"]', field: 'pmcid' },
    // arXiv
    { selector: 'meta[name="citation_arxiv_id"], meta[property="citation_arxiv_id"]', field: 'arxiv' },
    // ISBN
    { selector: 'meta[name="citation_isbn"], meta[property="citation_isbn"]', field: 'isbn' },
    // ISSN
    { selector: 'meta[name="citation_issn"], meta[property="citation_issn"]', field: 'issn' },
    // Journal
    { selector: 'meta[name="citation_journal_title"], meta[property="citation_journal_title"]', field: 'journal' },
    // Publisher - include DC.Publisher
    { selector: 'meta[name="citation_publisher"], meta[property="citation_publisher"], meta[name="dc.Publisher"], meta[name="DC.Publisher"]', field: 'publisher' },
    // Volume
    { selector: 'meta[name="citation_volume"], meta[property="citation_volume"]', field: 'volume' },
    // Issue
    { selector: 'meta[name="citation_issue"], meta[property="citation_issue"]', field: 'issue' },
    // Title - include DC.Title
    { selector: 'meta[name="citation_title"], meta[property="citation_title"], meta[name="dc.Title"], meta[name="DC.Title"]', field: 'title' },
    // Abstract URL
    { selector: 'meta[name="citation_abstract_html_url"], meta[property="citation_abstract_html_url"]', field: 'abstract_url' },
    // PDF URL
    { selector: 'meta[name="citation_pdf_url"], meta[property="citation_pdf_url"]', field: 'pdf_url' },
    // Type - include DC.Type
    { selector: 'meta[name="citation_type"], meta[property="citation_type"], meta[name="dc.Type"], meta[name="DC.Type"]', field: 'type' },
    // Format - include DC.Format
    { selector: 'meta[name="dc.Format"], meta[name="DC.Format"]', field: 'format' },
    // Language - include DC.Language
    { selector: 'meta[name="dc.Language"], meta[name="DC.Language"]', field: 'language' },
    // Coverage - include DC.Coverage
    { selector: 'meta[name="dc.Coverage"], meta[name="DC.Coverage"]', field: 'coverage' },
    // Rights - include DC.Rights
    { selector: 'meta[name="dc.Rights"], meta[name="DC.Rights"]', field: 'rights' },
  ];

  citationSelectors.forEach(({ selector, field }) => {
    const element = document.querySelector(selector);
    if (element) {
      const content = element.getAttribute('content');
      if (content) {
        citations[field] = content;
      }
    }
  });

  // Enhanced Dublin Core identifiers extraction (handle multiple identifier schemes)
  const dcIdentifiers = document.querySelectorAll('meta[name="dc.Identifier"], meta[name="DC.Identifier"], meta[name="dc.identifier"], meta[name="DC.identifier"]');
  if (dcIdentifiers.length > 0) {
    Array.from(dcIdentifiers).forEach(meta => {
      const content = meta.getAttribute('content');
      const scheme = meta.getAttribute('scheme');
      
      if (content) {
        // Handle different identifier schemes
        if (scheme) {
          const schemeLower = scheme.toLowerCase();
          switch (schemeLower) {
            case 'doi':
              if (!citations.doi) citations.doi = content;
              break;
            case 'publisher-id':
              citations.publisher_id = content;
              break;
            case 'pmid':
              if (!citations.pmid) citations.pmid = content;
              break;
            case 'pmcid':
              if (!citations.pmcid) citations.pmcid = content;
              break;
            case 'isbn':
              if (!citations.isbn) citations.isbn = content;
              break;
            case 'issn':
              if (!citations.issn) citations.issn = content;
              break;
            default:
              // Store other identifiers with scheme prefix
              citations[`identifier_${schemeLower}`] = content;
          }
        } else {
          // Enhanced DOI detection - more robust pattern matching
          if (content.match(/^10\.\d{4,}\/[^\s]+$/)) {
            if (!citations.doi) citations.doi = content;
          } else if (content.match(/^PMC\d+$/)) {
            if (!citations.pmcid) citations.pmcid = content;
          } else if (content.match(/^\d+$/) && content.length >= 6) {
            // Could be PMID or other numeric identifier
            if (!citations.pmid) citations.pmid = content;
          } else if (content.match(/^\d{4}\.\d{4,5}$/)) {
            // arXiv pattern
            if (!citations.arxiv) citations.arxiv = content;
          } else {
            // Store as generic identifier
            citations.identifier = content;
          }
        }
      }
    });
  }

  // Extract AAAS data layer information
  extractAAASDataLayer(citations, metadata);

  // Extract pages (first and last page)
  const firstPageMeta = document.querySelector('meta[name="citation_firstpage"], meta[property="citation_firstpage"]');
  const lastPageMeta = document.querySelector('meta[name="citation_lastpage"], meta[property="citation_lastpage"]');
  if (firstPageMeta) {
    const firstPage = firstPageMeta.getAttribute('content');
    const lastPage = lastPageMeta?.getAttribute('content');
    citations.pages = lastPage ? `${firstPage}-${lastPage}` : firstPage;
  }

  // Extract publication date/year - include DC.Date
  const dateSelectors = [
    'meta[name="citation_publication_date"]',
    'meta[name="citation_date"]',
    'meta[name="citation_year"]',
    'meta[property="citation_publication_date"]',
    'meta[property="citation_date"]',
    'meta[property="citation_year"]',
    'meta[name="dc.Date"]',
    'meta[name="DC.Date"]'
  ];

  for (const selector of dateSelectors) {
    const dateMeta = document.querySelector(selector);
    if (dateMeta) {
      const dateContent = dateMeta.getAttribute('content');
      const scheme = dateMeta.getAttribute('scheme');
      
      if (dateContent) {
        citations.publication_date = dateContent;
        
        // Handle different date schemes
        if (scheme && scheme.toLowerCase() === 'wtn8601') {
          // W3C date format
          citations.date_scheme = 'W3C-DTF';
        }
        
        // Extract year
        const yearMatch = dateContent.match(/(\d{4})/);
        if (yearMatch) {
          citations.year = yearMatch[1];
        }
        break;
      }
    }
  }

  // Extract authors - handle both citation and Dublin Core formats
  const authorMetas = document.querySelectorAll('meta[name="citation_author"], meta[property="citation_author"], meta[name="citation_authors"], meta[property="citation_authors"], meta[name="dc.Creator"], meta[name="DC.Creator"]');
  if (authorMetas.length > 0) {
    let allAuthors: string[] = [];
    
    Array.from(authorMetas).forEach(meta => {
      const content = meta.getAttribute('content');
      if (content) {
        // Check if this is a semicolon-separated list (common in citation_authors)
        if (content.includes(';')) {
          const separatedAuthors = content.split(';').map(a => a.trim()).filter(a => a);
          allAuthors.push(...separatedAuthors);
        } else {
          allAuthors.push(content);
        }
      }
    });
    
    if (allAuthors.length > 0) {
      citations.authors = allAuthors;
      // Extract first and last author for easy access
      citations.first_author = allAuthors[0];
      if (allAuthors.length > 1) {
        citations.last_author = allAuthors[allAuthors.length - 1];
      }
    }
  }

  // Extract description - include DC.Description
  const descriptionMeta = document.querySelector('meta[name="citation_abstract"], meta[property="citation_abstract"], meta[name="dc.Description"], meta[name="DC.Description"]');
  if (descriptionMeta) {
    citations.abstract_meta = descriptionMeta.getAttribute('content');
  }

  // Extract keywords from citation meta
  const keywordsMeta = document.querySelector('meta[name="citation_keywords"], meta[property="citation_keywords"]');
  if (keywordsMeta) {
    const keywordsContent = keywordsMeta.getAttribute('content');
    if (keywordsContent) {
      citations.keywords_meta = keywordsContent.split(/[,;]/).map(k => k.trim()).filter(k => k);
    }
  }

  // Fallback: Look for identifiers in page content if not found in meta tags
  if (!citations.doi) {
    const doiMatch = document.body.textContent?.match(/(?:doi:|DOI:)\s*(10\.\d{4,}\/[^\s]+)/i);
    if (doiMatch) {
      citations.doi = doiMatch[1];
    }
  }

  if (!citations.arxiv) {
    const arxivMatch = document.body.textContent?.match(/arXiv:(\d{4}\.\d{4,5})/i);
    if (arxivMatch) {
      citations.arxiv = arxivMatch[1];
    }
  }

  if (!citations.pmid) {
    const pmidMatch = document.body.textContent?.match(/PMID:\s*(\d+)/i);
    if (pmidMatch) {
      citations.pmid = pmidMatch[1];
    }
  }

  if (!citations.pmcid) {
    const pmcidMatch = document.body.textContent?.match(/PMC(\d+)/i);
    if (pmcidMatch) {
      citations.pmcid = `PMC${pmcidMatch[1]}`;
    }
  }

  // Only add citations if we found any citation-related metadata
  if (Object.keys(citations).length > 0) {
    metadata.citations = citations;
  }

  console.log('🔬 Extracted citation metadata:', Object.keys(citations));
}

/**
 * Extract AAAS data layer information
 */
function extractAAASDataLayer(citations: any, metadata: PageMetadata) {
  try {
    // Check if AAASdataLayer exists in the global scope
    const aaasData = (window as any).AAASdataLayer;
    
    if (aaasData && aaasData.page && aaasData.page.pageInfo) {
      const pageInfo = aaasData.page.pageInfo;
      
      // Extract DOI from AAAS data layer
      if (pageInfo.DOI && !citations.doi) {
        citations.doi = pageInfo.DOI;
      }
      
      // Extract other citation metadata from AAAS data layer
      if (pageInfo.author && !citations.authors) {
        // AAAS authors are pipe-separated
        const authors = pageInfo.author.split('|').map((a: string) => a.trim()).filter((a: string) => a);
        if (authors.length > 0) {
          citations.authors = authors;
          citations.first_author = authors[0];
          if (authors.length > 1) {
            citations.last_author = authors[authors.length - 1];
          }
        }
      }
      
      // Extract publication date
      if (pageInfo.pubDate && !citations.publication_date) {
        citations.publication_date = pageInfo.pubDate;
        // Extract year from date
        const yearMatch = pageInfo.pubDate.match(/(\d{4})/);
        if (yearMatch) {
          citations.year = yearMatch[1];
        }
      }
      
      // Extract issue date
      if (pageInfo.issueDate && !citations.issue_date) {
        citations.issue_date = pageInfo.issueDate;
      }
      
      // Extract volume and issue
      if (pageInfo.volume && !citations.volume) {
        citations.volume = pageInfo.volume;
      }
      
      if (pageInfo.issue && !citations.issue) {
        citations.issue = pageInfo.issue;
      }
      
      // Extract article type
      if (pageInfo.articleType && !citations.type) {
        citations.type = pageInfo.articleType;
      }
      
      // Extract NLM article type (more specific)
      if (pageInfo.nlmArticleType) {
        citations.nlm_article_type = pageInfo.nlmArticleType;
      }
      
      // Extract ISSN
      if (pageInfo.issnOnline && !citations.issn) {
        citations.issn = pageInfo.issnOnline;
      }
      
      // Extract page URL
      if (pageInfo.pageURL && !citations.url) {
        citations.url = pageInfo.pageURL;
      }
      
      // Extract view type (abstract, full text, etc.)
      if (pageInfo.viewType) {
        citations.view_type = pageInfo.viewType;
      }
      
      // Extract publication status
      if (pageInfo.inPress) {
        citations.in_press = pageInfo.inPress === 'yes';
      }
      
      if (pageInfo.firstRelease) {
        citations.first_release = pageInfo.firstRelease === 'yes';
      }
      
      // Store AAAS program information
      if (aaasData.page.attributes && aaasData.page.attributes.aaasProgram) {
        citations.aaas_program = aaasData.page.attributes.aaasProgram;
      }
      
      // Extract subject information
      if (aaasData.page.attributes && aaasData.page.attributes.subject) {
        citations.subject = aaasData.page.attributes.subject;
      }
      
      // Extract access information
      if (aaasData.page.attributes) {
        const attrs = aaasData.page.attributes;
        if (attrs.accessType) {
          citations.access_type = attrs.accessType;
        }
        if (attrs.freeAccess) {
          citations.free_access = attrs.freeAccess === 'yes';
        }
        if (attrs.openAccess) {
          citations.open_access = attrs.openAccess === 'yes';
        }
      }
      
      // Extract user access information
      if (aaasData.user) {
        citations.user_access = {
          access_method: aaasData.user.accessMethod,
          registered_user: aaasData.user.registeredUser === 'yes',
          authenticated: aaasData.user.authenticated === 'yes',
          entitled: aaasData.user.entitled === 'true',
          has_access: aaasData.user.access === 'yes'
        };
      }
      
      console.log('🔬 Extracted AAAS data layer metadata:', {
        doi: citations.doi,
        authors: citations.authors,
        volume: citations.volume,
        issue: citations.issue,
        pubDate: citations.publication_date
      });
    }
  } catch (error) {
    console.warn('Error extracting AAAS data layer:', error);
  }
}

/**
 * Clean URL by removing UTM and tracker parameters
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // List of tracker and UTM parameters to remove
    const trackerParams = [
      // UTM parameters
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      // Facebook
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
      // Google
      'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
      // Twitter
      'twclid', 't', 'ref_src', 'ref_url',
      // LinkedIn
      'li_fat_id', 'lipi',
      // TikTok
      'ttclid',
      // Pinterest
      'epik',
      // Mailchimp
      'mc_cid', 'mc_eid',
      // HubSpot
      'hsCtaTracking', '_hsenc', '_hsmi',
      // Marketo
      'mkt_tok',
      // Adobe
      's_cid',
      // Other common trackers
      'ref', 'referrer', 'source', 'campaign', 'medium', 'content', 'term',
      'affiliate', 'aff', 'partner', 'promo', 'coupon',
      // Social media share parameters
      'share', 'shared', 'via', 'recruiter', 'trk',
      // Analytics
      '_ga', '_gl', '_ke', 'yclid', 'msclkid',
      // Email marketing
      'email_source', 'email_campaign', 'newsletter',
      // Misc trackers
      'igshid', 'feature', 'app', 'si', 'context'
    ];
    
    // Remove tracker parameters
    trackerParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Return the cleaned URL
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return the original URL
    console.warn('Failed to clean URL:', error);
    return url;
  }
} 