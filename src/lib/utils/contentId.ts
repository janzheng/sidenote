export function generateContentId(url: string): string {
  // Normalize URL to ensure consistent IDs
  const normalizedUrl = normalizeUrl(url);
  return hashString(normalizedUrl);
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Comprehensive list of tracking/session parameters to strip
    const paramsToRemove = [
      // UTM
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      // Facebook
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
      // Google
      'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
      // Twitter/X
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
      // Common trackers
      'ref', 'referrer', 'source', 'campaign', 'medium', 'content', 'term',
      'affiliate', 'aff', 'partner', 'promo', 'coupon',
      // Social media share params
      'share', 'shared', 'via', 'recruiter', 'trk',
      // Analytics
      '_ga', '_gl', '_gid', '_gat', '_ke', 'yclid', 'msclkid',
      // Email marketing
      'email_source', 'email_campaign', 'newsletter',
      // Misc
      'igshid', 'feature', 'app', 'si', 'context',
      // Session/cache
      'sessionid', 'session_id', 'sid',
      'timestamp', 'ts',
      'cache', 'cb', 'cachebuster',
    ];

    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    // Always remove hash — it's client-side navigation, not content identity
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