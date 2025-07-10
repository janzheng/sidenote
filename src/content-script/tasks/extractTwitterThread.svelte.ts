import type { 
  TwitterThread, 
  SocialMediaPost, 
  SocialMediaUser, 
  SocialMediaEngagement
} from '../../types/socialMedia';

/**
 * Extract Twitter thread from the current page DOM
 */
export async function extractTwitterThread(): Promise<{ success: boolean; thread?: TwitterThread; error?: string }> {
  try {
    console.log('🐦 Starting Twitter thread extraction from DOM');

    // Check if we're on a Twitter page
    const hostname = window.location.hostname.toLowerCase();
    if (!hostname.includes('twitter.com') && !hostname.includes('x.com')) {
      return {
        success: false,
        error: 'Not a Twitter/X page'
      };
    }

    // Extract tweets from the page
    const posts = await extractTweetsFromDOM();
    if (posts.length === 0) {
      return {
        success: false,
        error: 'No tweets found on the page'
      };
    }

    // Find the root post (first post or main tweet)
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
    const thread: TwitterThread = {
      id: rootPost.id,
      platform: 'twitter',
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
      threadType: posts.length > 1 ? 'main' : 'main',
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
      }
    };

    console.log('✅ Twitter thread extracted successfully:', {
      id: thread.id,
      posts: thread.posts.length,
      author: thread.author.username
    });

    return {
      success: true,
      thread
    };

  } catch (error) {
    console.error('❌ Twitter thread extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error'
    };
  }
}

/**
 * Extract tweets from the DOM
 */
async function extractTweetsFromDOM(): Promise<SocialMediaPost[]> {
  const posts: SocialMediaPost[] = [];

  // Look for tweet articles/containers
  const tweetSelectors = [
    '[data-testid="tweet"]',
    'article[data-testid="tweet"]',
    '[role="article"]'
  ];

  let tweetElements: Element[] = [];
  for (const selector of tweetSelectors) {
    tweetElements = Array.from(document.querySelectorAll(selector));
    if (tweetElements.length > 0) break;
  }

  console.log(`🐦 Found ${tweetElements.length} tweet elements`);

  for (let i = 0; i < tweetElements.length; i++) {
    const tweetElement = tweetElements[i];
    
    try {
      const post = await extractSingleTweet(tweetElement, i === 0);
      if (post) {
        posts.push(post);
      }
    } catch (error) {
      console.warn('Failed to extract tweet:', error);
    }
  }

  return posts;
}

/**
 * Extract a single tweet from a DOM element
 */
async function extractSingleTweet(element: Element, isRoot: boolean = false): Promise<SocialMediaPost | null> {
  try {
    // Extract tweet ID from URL or data attributes
    const tweetId = extractTweetId(element);
    if (!tweetId) {
      console.warn('No tweet ID found for element');
      return null;
    }

    // Extract text content
    const textElement = element.querySelector('[data-testid="tweetText"]') ||
                       element.querySelector('[lang]') ||
                       element.querySelector('div[dir="auto"]');
    
    const text = textElement?.textContent?.trim() || '';

    // Extract timestamp and URL
    const timeElement = element.querySelector('time');
    const createdAt = timeElement?.getAttribute('datetime') || new Date().toISOString();
    
    const linkElement = element.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
    const url = linkElement?.href || `${window.location.origin}${window.location.pathname}`;

    // Extract engagement metrics
    const engagement = extractEngagementFromElement(element);

    // Extract images
    const images = extractImagesFromElement(element);

    // Extract hashtags and mentions
    const hashtags = extractHashtagsFromText(text);
    const mentions = extractMentionsFromText(text);

    const post: SocialMediaPost = {
      id: tweetId,
      text,
      url,
      createdAt,
      engagement,
      images,
      hashtags,
      mentions,
      isRoot,
      parentId: isRoot ? undefined : undefined, // Could be enhanced to detect replies
      platform: 'twitter',
      author: extractAuthorFromDOM() // Add author for each post
    };

    return post;

  } catch (error) {
    console.error('Error extracting single tweet:', error);
    return null;
  }
}

/**
 * Extract tweet ID from element
 */
function extractTweetId(element: Element): string | null {
  // Try to get from URL in links
  const linkElement = element.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
  if (linkElement?.href) {
    const match = linkElement.href.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  // Try to get from data attributes
  const dataId = element.getAttribute('data-tweet-id') ||
                element.getAttribute('data-item-id');
  if (dataId) return dataId;

  // Fallback: generate from URL or timestamp
  const timeElement = element.querySelector('time');
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      return `generated_${Date.parse(datetime)}`;
    }
  }

  // Last resort: generate random ID
  return `generated_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract engagement metrics from tweet element
 */
function extractEngagementFromElement(element: Element): SocialMediaEngagement {
  const engagement: SocialMediaEngagement = {
    likes: 0,
    reposts: 0,
    replies: 0,
    views: 0
  };

  // Look for engagement buttons and their counts
  const engagementSelectors = {
    likes: ['[data-testid="like"]', '[aria-label*="like"]'],
    reposts: ['[data-testid="retweet"]', '[aria-label*="repost"]', '[aria-label*="retweet"]'],
    replies: ['[data-testid="reply"]', '[aria-label*="repl"]'],
    views: ['[data-testid="analytics"]', '[aria-label*="view"]']
  };

  for (const [metric, selectors] of Object.entries(engagementSelectors)) {
    for (const selector of selectors) {
      const button = element.querySelector(selector);
      if (button) {
        const countText = button.textContent || button.getAttribute('aria-label') || '';
        const count = parseEngagementCount(countText);
        if (count > 0) {
          engagement[metric as keyof SocialMediaEngagement] = count;
          break;
        }
      }
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
 * Extract images from tweet element
 */
function extractImagesFromElement(element: Element): Array<{url: string; alt?: string; width?: number; height?: number}> {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  const imageElements = element.querySelectorAll('img[src*="media"], img[src*="pbs.twimg.com"]');
  
  imageElements.forEach((img) => {
    const imgElement = img as HTMLImageElement;
    if (imgElement.src && !imgElement.src.includes('profile_images')) {
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
  return hashtags ? hashtags.map(tag => tag.substring(1)) : [];
}

/**
 * Extract mentions from text
 */
function extractMentionsFromText(text: string): string[] {
  const mentions = text.match(/@\w+/g);
  return mentions ? mentions.map(mention => mention.substring(1)) : [];
}

/**
 * Extract author information from the page
 */
function extractAuthorFromDOM(): SocialMediaUser {
  // Look for author information in the page
  const usernameElement = document.querySelector('[data-testid="UserName"]') ||
                         document.querySelector('[data-testid="userInfo"]');
  
  const displayNameElement = usernameElement?.querySelector('[dir="ltr"]') ||
                            usernameElement?.querySelector('span');
  
  const avatarElement = document.querySelector('[data-testid="UserAvatar"] img') as HTMLImageElement;
  
  // Extract username from URL or page content
  const urlMatch = window.location.pathname.match(/^\/([^\/]+)/);
  const username = urlMatch?.[1] || 'unknown';
  
  const displayName = displayNameElement?.textContent?.trim() || username;
  
  // Look for verification badge
  const verifiedElement = document.querySelector('[data-testid="verifiedBadge"]') ||
                         document.querySelector('[aria-label*="verified"]');
  
  const author: SocialMediaUser = {
    id: username,
    username,
    displayName,
    avatarUrl: avatarElement?.src,
    verified: !!verifiedElement,
    platform: 'twitter'
  };

  // Try to extract follower/following counts if visible
  const statsElements = document.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
  statsElements.forEach(element => {
    const text = element.textContent || '';
    const count = parseEngagementCount(text);
    
    if (element.getAttribute('href')?.includes('/followers')) {
      author.followers = count;
    } else if (element.getAttribute('href')?.includes('/following')) {
      author.following = count;
    }
  });

  return author;
}

/**
 * Expand Twitter thread by scrolling and loading more content
 */
export async function expandTwitterThread(currentThreadId: string, maxPosts: number = 100): Promise<{
  success: boolean;
  additionalPosts?: SocialMediaPost[];
  progress?: any;
  error?: string;
}> {
  try {
    console.log('🐦 Starting Twitter thread expansion');

    const initialPostCount = document.querySelectorAll('[data-testid="tweet"]').length;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;
    let additionalPosts: SocialMediaPost[] = [];

    // Scroll down to load more content
    while (scrollAttempts < maxScrollAttempts) {
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentPostCount = document.querySelectorAll('[data-testid="tweet"]').length;
      
      if (currentPostCount > initialPostCount + additionalPosts.length) {
        // New content loaded, extract it
        const allPosts = await extractTweetsFromDOM();
        const newPosts = allPosts.slice(initialPostCount + additionalPosts.length);
        additionalPosts.push(...newPosts);
        
        console.log(`🐦 Found ${newPosts.length} new posts (total: ${additionalPosts.length})`);
        
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
    console.error('❌ Twitter thread expansion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown expansion error'
    };
  }
} 