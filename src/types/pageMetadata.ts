export interface PageMetadata {
  title?: string; // From <title> tag

  // HTML Meta tags
  description?: string;
  keywords?: string;
  author?: string;
  publisher?: string;
  publishedDate?: string;
  modifiedDate?: string;
  language?: string;

  // Open Graph / Social Media
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogSiteName?: string;

  // Twitter Card
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;

  // Schema.org / JSON-LD
  schemaType?: string;
  schemaData?: any;

  // Additional JSON-LD extracted metadata
  breadcrumbs?: string[];
  siteName?: string;
  siteDescription?: string;
  organizationName?: string;
  organizationLogo?: string;
  personName?: string;
  personDescription?: string;
  productName?: string;
  productDescription?: string;
  productBrand?: string;
  productPrice?: string;
  mediaTitle?: string;
  mediaDescription?: string;
  mediaDuration?: string;
  mediaUploadDate?: string;

  // Technical metadata
  viewport?: string;
  charset?: string;
  robots?: string;
  canonical?: string;
  contentType?: string;
  domain?: string;
  filename?: string; // Canonical filename for downloads/references

  // Additional extracted metadata
  headings?: {
    h1?: string[];
    h2?: string[];
    h3?: string[];
  };
  images?: {
    count: number;
    uniqueCount?: number; // Count after deduplication
    items: Array<{
      url: string;
      alt: string;
    }>;
  };
  links?: {
    internal: number;
    external: number;
  };

  // Academic/Citation metadata
  citations?: {
    // Core identifiers
    doi?: string;
    pmid?: string;
    pmcid?: string;
    arxiv?: string;
    isbn?: string;
    issn?: string;

    // Publication details
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    publication_date?: string;
    year?: string;
    type?: string;
    format?: string;

    // Author information
    authors?: string[];
    first_author?: string;
    last_author?: string;

    // Content
    title?: string;
    abstract_meta?: string;
    keywords_meta?: string[];

    // URLs
    abstract_url?: string;
    pdf_url?: string;
    url?: string;

    // Dublin Core fields
    coverage?: string;
    rights?: string;
    date_scheme?: string;
    identifier?: string;
    publisher_id?: string;

    // AAAS-specific fields
    issue_date?: string;
    nlm_article_type?: string;
    view_type?: string;
    in_press?: boolean;
    first_release?: boolean;
    aaas_program?: string;
    subject?: string;
    access_type?: string;
    free_access?: boolean;
    open_access?: boolean;
    user_access?: {
      access_method?: string;
      registered_user?: boolean;
      authenticated?: boolean;
      entitled?: boolean;
      has_access?: boolean;
    };

    // Dynamic identifier fields (for scheme-based identifiers)
    [key: string]: any;
  };
}
