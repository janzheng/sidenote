export function generateContentId(url: string): string {
  // Normalize URL to ensure consistent IDs
  const normalizedUrl = normalizeUrl(url);
  return hashString(normalizedUrl);
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Only remove common tracking/session parameters, preserve content-related ones
    const paramsToRemove = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'twclid',
      'ref', 'referrer', 'source',
      'sessionid', 'session_id', 'sid',
      '_ga', '_gid', '_gat',
      'timestamp', 'ts', 't',
      'cache', 'cb', 'cachebuster',
      'v', 'version' // only if they look like cache busters
    ];
    
    // Remove tracking parameters but keep content-related ones
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Always remove hash as it's usually for client-side navigation
    urlObj.hash = '';
    
    return urlObj.toString();
  } catch {
    return url;
  }
}

export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
} 