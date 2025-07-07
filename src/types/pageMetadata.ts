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

}
