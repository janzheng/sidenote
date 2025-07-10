import type { 
  LinkedInThread, 
  SocialMediaPost, 
  SocialMediaUser, 
  SocialMediaEngagement
} from '../../types/socialMedia';

/**
 * Extract LinkedIn thread from the current page DOM
 */
export async function extractLinkedInThread(): Promise<{ success: boolean; thread?: LinkedInThread; error?: string }> {
  try {
    console.log('🔗 Starting LinkedIn thread extraction from DOM');

    // Check if we're on a LinkedIn page
    const hostname = window.location.hostname.toLowerCase();
    if (!hostname.includes('linkedin.com')) {
      return {
        success: false,
        error: 'Not a LinkedIn page'
      };
    }

    // Extract posts from the page
    const posts = await extractPostsFromDOM();
    if (posts.length === 0) {
      return {
        success: false,
        error: 'No posts found on the page'
      };
    }

    // Find the root post (first post or main post)
    const rootPost = posts[0];
    
    // Extract author information from the root post
    const author = extractAuthorFromDOM();

    // Calculate total engagement
    const totalEngagement = posts.reduce((total, post) => ({
      likes: total.likes + post.engagement.likes,
      reposts: total.reposts + post.engagement.reposts,
      replies: total.replies + post.engagement.replies,
      views: total.views + (post.engagement.views || 0)
    }), { likes: 0, reposts: 0, replies: 0, views: 0 });

    // Create thread object
    const thread: LinkedInThread = {
      id: rootPost.id,
      platform: 'linkedin',
      url: window.location.href,
      rootPost,
      posts,
      totalPosts: posts.length,
      author,
      totalEngagement,
      extractedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      isComplete: true,
      hasMoreReplies: false,
      quality: {
        score: 0, // Will be calculated by the service
        factors: {
          engagement: 0,
          authorCredibility: 0,
          contentDepth: 0,
          threadCohesion: 0
        },
        reasons: []
      },
      expansionPotential: {
        canExpand: false,
        estimatedAdditionalPosts: 0,
        expansionMethods: [],
        scrollRequired: false
      },
      platformSpecific: {
        linkedin: {
          postType: detectPostType(),
          isSponsored: detectSponsoredContent(),
          targetAudience: [],
          industryContext: extractIndustryContext(),
          companyPages: extractCompanyPages()
        }
      }
    };

    console.log('✅ LinkedIn thread extracted successfully:', {
      id: thread.id,
      posts: thread.posts.length,
      author: thread.author.username
    });

    return {
      success: true,
      thread
    };

  } catch (error) {
    console.error('❌ LinkedIn thread extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error'
    };
  }
}

/**
 * Extract posts from the DOM
 */
async function extractPostsFromDOM(): Promise<SocialMediaPost[]> {
  const posts: SocialMediaPost[] = [];

  // Look for LinkedIn post containers
  const postSelectors = [
    '.feed-shared-update-v2',
    '.feed-shared-article',
    'article[data-id]',
    '.comments-comment-entity'
  ];

  let postElements: Element[] = [];
  for (const selector of postSelectors) {
    postElements = Array.from(document.querySelectorAll(selector));
    if (postElements.length > 0) break;
  }

  console.log(`🔗 Found ${postElements.length} post elements`);

  for (let i = 0; i < postElements.length; i++) {
    const postElement = postElements[i];
    
    try {
      const post = await extractSinglePost(postElement, i === 0);
      if (post) {
        posts.push(post);
      }
    } catch (error) {
      console.warn('Failed to extract LinkedIn post:', error);
    }
  }

  return posts;
}

/**
 * Extract a single post from a DOM element
 */
async function extractSinglePost(element: Element, isRoot: boolean = false): Promise<SocialMediaPost | null> {
  try {
    // Extract post ID from data attributes or URL
    const postId = extractPostId(element);
    if (!postId) {
      console.warn('No post ID found for element');
      return null;
    }

    // Extract text content
    const textElement = element.querySelector('.feed-shared-update-v2__description, .comments-comment-item__main-content, .update-components-text') ||
                       element.querySelector('[lang]') ||
                       element.querySelector('div[dir="auto"]');
    
    const text = textElement?.textContent?.trim() || '';

    // Extract timestamp and URL
    const timeElement = element.querySelector('time, .comments-comment-meta__data time');
    const createdAt = timeElement?.getAttribute('datetime') || 
                     parseRelativeTime(timeElement?.textContent || '') || 
                     new Date().toISOString();
    
    const linkElement = element.querySelector('a[href*="/posts/"], a[href*="/activity/"]') as HTMLAnchorElement;
    const url = linkElement?.href || window.location.href;

    // Extract engagement metrics
    const engagement = extractEngagementFromElement(element);

    // Extract images
    const images = extractImagesFromElement(element);

    // Extract hashtags and mentions
    const hashtags = extractHashtagsFromText(text);
    const mentions = extractMentionsFromText(text);

    // Extract author for this post
    const author = extractAuthorFromPostElement(element);

    const post: SocialMediaPost = {
      id: postId,
      text,
      author,
      createdAt,
      engagement,
      images,
      hashtags,
      mentions,
      isRoot,
      parentId: isRoot ? undefined : undefined, // Could be enhanced to detect replies
      platform: 'linkedin',
      url
    };

    return post;

  } catch (error) {
    console.error('Error extracting single LinkedIn post:', error);
    return null;
  }
}

/**
 * Extract post ID from element
 */
function extractPostId(element: Element): string | null {
  // Try to get from data attributes
  const dataId = element.getAttribute('data-id') ||
                element.getAttribute('data-urn') ||
                element.getAttribute('data-activity-urn');
  if (dataId) return dataId;

  // Try to get from URL in links
  const linkElement = element.querySelector('a[href*="/posts/"], a[href*="/activity/"]') as HTMLAnchorElement;
  if (linkElement?.href) {
    const match = linkElement.href.match(/\/posts\/([^/?]+)|\/activity-(\d+)/);
    if (match) return match[1] || match[2];
  }

  // Fallback: generate from timestamp or position
  const timeElement = element.querySelector('time');
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      return `linkedin_post_${Date.parse(datetime)}`;
    }
  }

  // Last resort: generate random ID
  return `linkedin_post_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract engagement metrics from post element
 */
function extractEngagementFromElement(element: Element): SocialMediaEngagement {
  const engagement: SocialMediaEngagement = {
    likes: 0,
    reposts: 0,
    replies: 0,
    views: 0
  };

  // Look for reaction count
  const reactionButton = element.querySelector('[aria-label*="reaction"], [aria-label*="like"], .social-actions-button');
  if (reactionButton) {
    const reactionText = reactionButton.textContent || reactionButton.getAttribute('aria-label') || '';
    const count = parseEngagementCount(reactionText);
    if (count > 0) {
      engagement.likes = count;
    }
  }

  // Look for comment count
  const commentButton = element.querySelector('[aria-label*="comment"], .comments-comment-texteditor');
  if (commentButton) {
    const commentText = commentButton.textContent || commentButton.getAttribute('aria-label') || '';
    const count = parseEngagementCount(commentText);
    if (count > 0) {
      engagement.replies = count;
    }
  }

  // Look for share/repost count
  const shareButton = element.querySelector('[aria-label*="share"], [aria-label*="repost"]');
  if (shareButton) {
    const shareText = shareButton.textContent || shareButton.getAttribute('aria-label') || '';
    const count = parseEngagementCount(shareText);
    if (count > 0) {
      engagement.reposts = count;
    }
  }

  return engagement;
}

/**
 * Parse engagement count from text
 */
function parseEngagementCount(text: string): number {
  if (!text) return 0;
  
  const match = text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*([KMB]?)/i);
  if (!match) return 0;
  
  const number = parseFloat(match[1].replace(/,/g, ''));
  const multiplier = match[2].toUpperCase();
  
  switch (multiplier) {
    case 'K': return Math.floor(number * 1000);
    case 'M': return Math.floor(number * 1000000);
    case 'B': return Math.floor(number * 1000000000);
    default: return Math.floor(number);
  }
}

/**
 * Extract images from post element
 */
function extractImagesFromElement(element: Element): Array<{url: string; alt?: string; width?: number; height?: number}> {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  const imageElements = element.querySelectorAll('img[src]');
  
  imageElements.forEach((img) => {
    const imgElement = img as HTMLImageElement;
    if (imgElement.src && 
        !imgElement.src.includes('profile-displayphoto') && 
        !imgElement.src.includes('company-logo') &&
        !imgElement.className.includes('lazy-image') &&
        imgElement.naturalWidth > 100) {
      images.push({
        url: imgElement.src,
        alt: imgElement.alt || undefined,
        width: imgElement.naturalWidth || undefined,
        height: imgElement.naturalHeight || undefined
      });
    }
  });
  
  return images;
}

/**
 * Extract hashtags from text
 */
function extractHashtagsFromText(text: string): string[] {
  const hashtags = text.match(/#\w+/g);
  return hashtags ? hashtags : [];
}

/**
 * Extract mentions from text
 */
function extractMentionsFromText(text: string): string[] {
  const mentions = text.match(/@[\w-]+/g);
  return mentions ? mentions : [];
}

/**
 * Extract author information from the page (main author)
 */
function extractAuthorFromDOM(): SocialMediaUser {
  // Look for author information in the main post
  const authorElement = document.querySelector('.feed-shared-actor, .update-components-actor');
  
  const nameElement = authorElement?.querySelector('.feed-shared-actor__name, .update-components-actor__name') ||
                     document.querySelector('h1');
  
  const avatarElement = authorElement?.querySelector('img') as HTMLImageElement ||
                       document.querySelector('.feed-shared-actor__avatar img') as HTMLImageElement;
  
  // Extract username from URL or page content
  const urlMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
  const username = urlMatch?.[1] || 'unknown';
  
  const displayName = nameElement?.textContent?.trim() || username;
  
  // Look for verification or premium indicators
  const verifiedElement = authorElement?.querySelector('.feed-shared-actor__verified, .premium-icon');
  
  // Extract title/headline
  const titleElement = authorElement?.querySelector('.feed-shared-actor__description, .update-components-actor__description');
  const title = titleElement?.textContent?.trim();

  const author: SocialMediaUser = {
    id: username,
    username,
    displayName,
    avatarUrl: avatarElement?.src,
    verified: !!verifiedElement,
    platform: 'linkedin',
    platformSpecific: {
      linkedin: {
        title,
        connectionDegree: extractConnectionDegree(authorElement),
        company: extractCompany(titleElement?.textContent || ''),
        isPremium: !!verifiedElement
      }
    }
  };

  return author;
}

/**
 * Extract author from individual post element
 */
function extractAuthorFromPostElement(element: Element): SocialMediaUser {
  const authorElement = element.querySelector('.feed-shared-actor, .comments-comment-meta, .update-components-actor');
  
  const nameElement = authorElement?.querySelector('.feed-shared-actor__name, .comments-comment-meta__description-title, .update-components-actor__name');
  const displayName = nameElement?.textContent?.trim() || 'Unknown User';
  
  const avatarElement = authorElement?.querySelector('img') as HTMLImageElement;
  
  // Extract profile URL
  const profileLink = authorElement?.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
  const profileUrl = profileLink?.href;
  const username = profileUrl ? extractUsernameFromUrl(profileUrl) : 'unknown';
  
  // Extract title
  const titleElement = authorElement?.querySelector('.feed-shared-actor__description, .comments-comment-meta__description-subtitle, .update-components-actor__description');
  const title = titleElement?.textContent?.trim();

  const author: SocialMediaUser = {
    id: username,
    username,
    displayName,
    avatarUrl: avatarElement?.src,
    profileUrl,
    verified: false,
    platform: 'linkedin',
    platformSpecific: {
      linkedin: {
        title,
        connectionDegree: extractConnectionDegree(authorElement),
        company: extractCompany(title || '')
      }
    }
  };

  return author;
}

/**
 * Extract username from LinkedIn profile URL
 */
function extractUsernameFromUrl(url: string): string {
  const match = url.match(/\/in\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Extract connection degree from author element
 */
function extractConnectionDegree(element: Element | null): '1st' | '2nd' | '3rd' | 'Out of network' | undefined {
  if (!element) return undefined;
  
  const text = element.textContent?.toLowerCase() || '';
  if (text.includes('1st')) return '1st';
  if (text.includes('2nd')) return '2nd';
  if (text.includes('3rd')) return '3rd';
  return undefined;
}

/**
 * Extract company from title text
 */
function extractCompany(title: string): string | undefined {
  const atMatch = title.match(/\s+at\s+(.+?)(?:\s+\||$)/i);
  if (atMatch) return atMatch[1].trim();
  
  const companyMatch = title.match(/,\s*(.+?)(?:\s+\||$)/);
  if (companyMatch) return companyMatch[1].trim();
  
  return undefined;
}

/**
 * Parse relative time to ISO string
 */
function parseRelativeTime(timeText: string): string | null {
  if (!timeText) return null;
  
  const now = new Date();
  const match = timeText.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i);
  
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'minute':
      now.setMinutes(now.getMinutes() - value);
      break;
    case 'hour':
      now.setHours(now.getHours() - value);
      break;
    case 'day':
      now.setDate(now.getDate() - value);
      break;
    case 'week':
      now.setDate(now.getDate() - (value * 7));
      break;
    case 'month':
      now.setMonth(now.getMonth() - value);
      break;
    case 'year':
      now.setFullYear(now.getFullYear() - value);
      break;
  }
  
  return now.toISOString();
}

/**
 * Detect post type from page content
 */
function detectPostType(): 'feed' | 'article' | 'video' | 'document' | 'poll' {
  if (document.querySelector('video')) return 'video';
  if (document.querySelector('.article-header, .article-content')) return 'article';
  if (document.querySelector('.poll-container, .voting-container')) return 'poll';
  if (document.querySelector('.document-container, .file-attachment')) return 'document';
  return 'feed';
}

/**
 * Detect if content is sponsored
 */
function detectSponsoredContent(): boolean {
  return !!document.querySelector('.feed-shared-actor__sponsored, .sponsored-label, [data-test-id="sponsored-label"]');
}

/**
 * Extract industry context from page
 */
function extractIndustryContext(): string[] {
  const industries: string[] = [];
  
  // Look for industry tags or mentions in the content
  const text = document.body.textContent?.toLowerCase() || '';
  const industryKeywords = [
    'technology', 'healthcare', 'finance', 'education', 'marketing',
    'sales', 'engineering', 'design', 'consulting', 'manufacturing'
  ];
  
  industryKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      industries.push(keyword);
    }
  });
  
  return industries.slice(0, 3); // Limit to 3 most relevant
}

/**
 * Extract company pages mentioned
 */
function extractCompanyPages(): string[] {
  const companies: string[] = [];
  
  const companyLinks = document.querySelectorAll('a[href*="/company/"]');
  companyLinks.forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    const match = href.match(/\/company\/([^\/]+)/);
    if (match) {
      companies.push(match[1]);
    }
  });
  
  return companies;
}

/**
 * Expand LinkedIn thread by scrolling and loading more content
 */
export async function expandLinkedInThread(currentThreadId: string, maxPosts: number = 100): Promise<{
  success: boolean;
  additionalPosts?: SocialMediaPost[];
  progress?: any;
  error?: string;
}> {
  try {
    console.log('🔗 Starting LinkedIn thread expansion');

    const initialPostCount = document.querySelectorAll('.feed-shared-update-v2, .comments-comment-entity').length;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;
    let additionalPosts: SocialMediaPost[] = [];

    // Click "Load more comments" buttons and scroll down to load more content
    while (scrollAttempts < maxScrollAttempts) {
      // Look for "Load more" buttons and click them
      const loadMoreButtons = document.querySelectorAll('button[aria-label*="Load more"], .comments-comments-list__load-more-comments-button');
      loadMoreButtons.forEach(button => {
        if (button instanceof HTMLElement && button.offsetParent !== null) {
          button.click();
        }
      });

      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentPostCount = document.querySelectorAll('.feed-shared-update-v2, .comments-comment-entity').length;
      
      if (currentPostCount > initialPostCount + additionalPosts.length) {
        // New content loaded, extract it
        const allPosts = await extractPostsFromDOM();
        const newPosts = allPosts.slice(initialPostCount + additionalPosts.length);
        additionalPosts.push(...newPosts);
        
        console.log(`🔗 Found ${newPosts.length} new posts (total: ${additionalPosts.length})`);
        
        if (additionalPosts.length >= maxPosts) {
          break;
        }
      } else {
        // No new content, increment scroll attempts
        scrollAttempts++;
      }
    }

    return {
      success: true,
      additionalPosts,
      progress: {
        expandedCount: scrollAttempts,
        totalFound: additionalPosts.length,
        currentStep: 'Expansion completed'
      }
    };

  } catch (error) {
    console.error('❌ LinkedIn thread expansion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown expansion error'
    };
  }
} 