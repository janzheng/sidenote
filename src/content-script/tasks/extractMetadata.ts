export function extractMetadata() {
  try {
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      author: document.querySelector('meta[name="author"]')?.getAttribute('content') || '',
      keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      lang: document.documentElement.lang || '',
      charset: document.characterSet || ''
    };
  } catch (error) {
    console.error('📄 Metadata extraction failed:', error);
    return {
      title: document.title,
      description: '',
      error: 'Metadata extraction failed'
    };
  }
} 