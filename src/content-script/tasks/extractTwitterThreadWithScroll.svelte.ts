import { ScrollCapture, createTwitterScrollConfig, type ScrollCaptureProgress } from './scrollCapture.svelte';
import { extractTwitterThread } from './extractTwitterThread.svelte';
import type { TwitterThread, SocialMediaPost } from '../../types/socialMedia';

interface TweetIdentifier {
  id: string;
  url: string;
  timestamp: string;
  textHash: string;
  domIndex: number;
  elementId: string;
}

interface ExtractedTweetData {
  post: SocialMediaPost;
  identifier: TweetIdentifier;
  domOrder: number;
  extractedAt: number;
}

export async function extractTwitterThreadWithScroll(
  maxScrolls: number = 100, 
  scrollDelay: number = 300
): Promise<{
  success: boolean;
  thread?: TwitterThread;
  progress?: any;
  error?: string;
}> {
  try {
    console.log('🐦 Starting enhanced Twitter thread extraction with scrolling...');
    console.log('🐦 Parameters:', { maxScrolls, scrollDelay });
    console.log('🐦 Current URL:', window.location.href);

    // PHASE 1: Click "Show more" and "Show replies" buttons
    console.log('🐦 Phase 1: Expanding truncated content...');
    await expandTruncatedContent();

    // PHASE 2: Extract initial tweets and set up deduplication
    console.log('🐦 Phase 2: Initial tweet extraction...');
    const tweetDatabase = new Map<string, ExtractedTweetData>();
    let domOrderCounter = 0;
    
    // Extract initial tweets
    await extractAndStoreTweets(tweetDatabase, domOrderCounter);
    const initialCount = tweetDatabase.size;
    console.log(`🐦 Initial extraction: ${initialCount} unique tweets`);

    // PHASE 3: Scroll and extract with improved deduplication
    console.log('🐦 Phase 3: Scrolling and extracting...');
    
    const scrollConfig = createTwitterScrollConfig(maxScrolls, scrollDelay);
    const scrollCapture = new ScrollCapture(scrollConfig);
    
    let lastExtractedCount = initialCount;
    let stableExtractionCount = 0;
    const maxStableExtractions = 5; // Stop if no new tweets for 5 scroll cycles
    
    // Set up progress callback with continuous extraction
    const progressCallback = async (progress: ScrollCaptureProgress) => {
      try {
        // Click any new "Show more" buttons that appeared
        await expandTruncatedContent();
        
        // Extract tweets at current position
        const beforeCount = tweetDatabase.size;
        domOrderCounter = await extractAndStoreTweets(tweetDatabase, domOrderCounter);
        const afterCount = tweetDatabase.size;
        const newTweets = afterCount - beforeCount;
        
        if (newTweets > 0) {
          console.log(`🐦 Found ${newTweets} new tweets during scroll (total: ${afterCount})`);
          stableExtractionCount = 0;
          lastExtractedCount = afterCount;
        } else {
          stableExtractionCount++;
        }
        
        // Stop scrolling if we haven't found new tweets for several cycles
        if (stableExtractionCount >= maxStableExtractions) {
          console.log('🐦 No new tweets found for several cycles, stopping scroll capture');
          scrollCapture.stop();
        }
        
        // Send progress update
        chrome.runtime.sendMessage({
          action: 'updateExtractionProgress',
          progress: {
            expandedCount: progress.scrollCount,
            totalFound: afterCount,
            currentStep: `Scrolled ${progress.scrollCount} times, found ${afterCount} tweets (${newTweets} new)`
          }
        }).catch(() => {
          // Ignore errors - background script might not be ready
        });
        
      } catch (error) {
        console.warn('🐦 Error during scroll extraction:', error);
      }
    };

    scrollCapture.setProgressCallback(progressCallback);
    
    const scrollResult = await scrollCapture.capture();
    console.log('🐦 Scroll capture completed:', {
      success: scrollResult.success,
      totalScrolls: scrollResult.totalScrolls,
      stoppedReason: scrollResult.progress.stoppedReason,
      finalTweetCount: tweetDatabase.size
    });

    // PHASE 4: Final extraction and cleanup
    console.log('🐦 Phase 4: Final extraction and thread building...');
    
    // One final extraction to catch any remaining tweets
    await expandTruncatedContent();
    await extractAndStoreTweets(tweetDatabase, domOrderCounter);
    
    const finalTweetCount = tweetDatabase.size;
    console.log(`🐦 Final tweet count: ${finalTweetCount}`);

    if (finalTweetCount === 0) {
      return {
        success: false,
        error: 'No tweets were captured during extraction',
        progress: {
          expandedCount: scrollResult.totalScrolls,
          totalFound: 0,
          currentStep: 'No tweets captured'
        }
      };
    }

    // PHASE 5: Build thread preserving display order
    console.log('🐦 Phase 5: Building thread with preserved order...');
    
    // Sort by DOM order to preserve Twitter's algorithmic ordering
    const sortedTweets = Array.from(tweetDatabase.values())
      .sort((a, b) => a.domOrder - b.domOrder);
    
    const allPosts = sortedTweets.map(tweet => tweet.post);
    
    // Use the first tweet as root (top of timeline)
    const rootPost = allPosts[0];
    
    // Get author from initial extraction or first post
    const initialExtractionResult = await extractTwitterThread();
    const author = initialExtractionResult.thread?.author || rootPost.author;

    // Calculate total engagement
    const totalEngagement = allPosts.reduce((total, post) => ({
      likes: total.likes + post.engagement.likes,
      reposts: total.reposts + post.engagement.reposts,
      replies: total.replies + post.engagement.replies,
      views: total.views + (post.engagement.views || 0)
    }), { likes: 0, reposts: 0, replies: 0, views: 0 });

    const completeThread: TwitterThread = {
      id: rootPost.id,
      platform: 'twitter',
      url: window.location.href,
      rootPost,
      posts: allPosts,
      totalPosts: allPosts.length,
      author,
      totalEngagement,
      extractedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      isComplete: true,
      hasMoreReplies: false,
      threadType: 'main',
      quality: {
        score: 0,
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

    console.log('✅ Enhanced Twitter thread extraction completed:', {
      id: completeThread.id,
      posts: completeThread.posts.length,
      author: completeThread.author.username,
      totalScrolls: scrollResult.totalScrolls,
      uniqueTweetIds: tweetDatabase.size,
      preservedOrder: true
    });

    return {
      success: true,
      thread: completeThread,
      progress: {
        expandedCount: scrollResult.totalScrolls,
        totalFound: completeThread.posts.length,
        currentStep: `Enhanced extraction completed - ${completeThread.posts.length} tweets captured in display order`
      }
    };

  } catch (error) {
    console.error('❌ Enhanced Twitter thread extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during enhanced extraction',
      progress: {
        expandedCount: 0,
        totalFound: 0,
        currentStep: 'Enhanced extraction failed'
      }
    };
  }
}

/**
 * Extract tweets from current DOM and store with bulletproof deduplication
 */
async function extractAndStoreTweets(
  tweetDatabase: Map<string, ExtractedTweetData>,
  startingDomOrder: number
): Promise<number> {
  const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
  let domOrderCounter = startingDomOrder;
  
  for (const element of tweetElements) {
    try {
      const tweetData = await extractSingleTweetWithIdentifier(element, domOrderCounter);
      if (tweetData) {
        const uniqueKey = generateUniqueKey(tweetData.identifier);
        
        // Only store if we haven't seen this exact tweet before
        if (!tweetDatabase.has(uniqueKey)) {
          tweetDatabase.set(uniqueKey, tweetData);
          console.log(`🐦 Stored new tweet: ${tweetData.identifier.id} (DOM order: ${domOrderCounter})`);
        }
        
        domOrderCounter++;
      }
    } catch (error) {
      console.warn('🐦 Failed to extract tweet:', error);
      domOrderCounter++;
    }
  }
  
  return domOrderCounter;
}

/**
 * Extract a single tweet with comprehensive identifier for deduplication
 */
async function extractSingleTweetWithIdentifier(
  element: Element,
  domOrder: number
): Promise<ExtractedTweetData | null> {
  try {
    // Generate a unique element ID for this DOM element
    const elementId = generateElementId(element);
    
    // Extract basic tweet data
    const tweetId = extractTweetId(element);
    if (!tweetId) return null;

    const textElement = element.querySelector('[data-testid="tweetText"]') ||
                       element.querySelector('[lang]') ||
                       element.querySelector('div[dir="auto"]');
    
    const text = textElement?.textContent?.trim() || '';
    
    // Create text hash for deduplication
    const textHash = createTextHash(text);
    
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

    // Extract author for this specific tweet
    const author = extractAuthorFromTweetElement(element);

    const identifier: TweetIdentifier = {
      id: tweetId,
      url,
      timestamp: createdAt,
      textHash,
      domIndex: domOrder,
      elementId
    };

    const post: SocialMediaPost = {
      id: tweetId,
      text,
      url,
      createdAt,
      engagement,
      images,
      hashtags,
      mentions,
      isRoot: domOrder === 0,
      platform: 'twitter',
      author
    };

    return {
      post,
      identifier,
      domOrder,
      extractedAt: Date.now()
    };

  } catch (error) {
    console.error('Error extracting tweet with identifier:', error);
    return null;
  }
}

/**
 * Generate a unique key for deduplication using multiple identifiers
 */
function generateUniqueKey(identifier: TweetIdentifier): string {
  // Use multiple identifiers to create a bulletproof unique key
  const keyParts = [
    identifier.id,
    identifier.textHash,
    identifier.timestamp,
    identifier.url.split('/').pop() || '' // Tweet ID from URL
  ];
  
  return keyParts.join('|');
}

/**
 * Generate a unique element ID for DOM tracking
 */
function generateElementId(element: Element): string {
  // Try to get existing ID or create one based on position and content
  const existingId = element.id;
  if (existingId) return existingId;
  
  // Create ID based on position in DOM and some content
  const rect = element.getBoundingClientRect();
  const textContent = element.textContent?.substring(0, 50) || '';
  const textHash = createTextHash(textContent);
  
  return `tweet_${rect.top}_${rect.left}_${textHash}`;
}

/**
 * Create a hash of text content for deduplication
 */
function createTextHash(text: string): string {
  // Simple hash function for text content
  let hash = 0;
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Extract tweet ID from element using multiple methods
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

  // Try to get from aria-labelledby or other attributes
  const ariaLabel = element.getAttribute('aria-labelledby');
  if (ariaLabel) {
    const match = ariaLabel.match(/tweet-(\d+)/);
    if (match) return match[1];
  }

  // Generate from timestamp and position
  const timeElement = element.querySelector('time');
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      const timestamp = Date.parse(datetime);
      const rect = element.getBoundingClientRect();
      return `generated_${timestamp}_${Math.round(rect.top)}`;
    }
  }

  // Last resort: generate from position and content
  const rect = element.getBoundingClientRect();
  const textContent = element.textContent?.substring(0, 100) || '';
  const contentHash = createTextHash(textContent);
  return `generated_${Math.round(rect.top)}_${contentHash}`;
}

/**
 * Extract engagement metrics from tweet element
 */
function extractEngagementFromElement(element: Element): any {
  const engagement = {
    likes: 0,
    reposts: 0,
    replies: 0,
    views: 0
  };

  // Look for engagement buttons and their counts
  const engagementButtons = element.querySelectorAll('[role="button"]');
  
  engagementButtons.forEach(button => {
    const ariaLabel = button.getAttribute('aria-label') || '';
    const text = button.textContent?.trim() || '';
    
    // Parse engagement counts
    if (ariaLabel.includes('like') || ariaLabel.includes('Like')) {
      engagement.likes = parseEngagementCount(text) || parseEngagementCount(ariaLabel);
    } else if (ariaLabel.includes('repost') || ariaLabel.includes('Repost') || ariaLabel.includes('retweet')) {
      engagement.reposts = parseEngagementCount(text) || parseEngagementCount(ariaLabel);
    } else if (ariaLabel.includes('repl') || ariaLabel.includes('Repl')) {
      engagement.replies = parseEngagementCount(text) || parseEngagementCount(ariaLabel);
    }
  });

  // Look for view counts
  const viewsElement = element.querySelector('[data-testid="app-text-transition-container"]');
  if (viewsElement) {
    const viewsText = viewsElement.textContent || '';
    if (viewsText.includes('View')) {
      engagement.views = parseEngagementCount(viewsText);
    }
  }

  return engagement;
}

/**
 * Parse engagement count from text
 */
function parseEngagementCount(text: string): number {
  if (!text) return 0;
  
  const match = text.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();
  
  switch (suffix) {
    case 'K': return Math.round(num * 1000);
    case 'M': return Math.round(num * 1000000);
    case 'B': return Math.round(num * 1000000000);
    default: return Math.round(num);
  }
}

/**
 * Extract images from tweet element
 */
function extractImagesFromElement(element: Element): any[] {
  const images: any[] = [];
  const imageElements = element.querySelectorAll('img[src]');
  
  imageElements.forEach(img => {
    if (img instanceof HTMLImageElement) {
      const src = img.src;
      const alt = img.alt || '';
      
      // Skip profile pictures and icons
      if (src && !src.includes('profile_images') && !alt.includes('avatar')) {
        images.push({
          url: src,
          alt: alt
        });
      }
    }
  });
  
  return images;
}

/**
 * Extract hashtags from text
 */
function extractHashtagsFromText(text: string): string[] {
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags;
}

/**
 * Extract mentions from text
 */
function extractMentionsFromText(text: string): string[] {
  const mentions = text.match(/@\w+/g) || [];
  return mentions;
}

/**
 * Extract author from individual tweet element
 */
function extractAuthorFromTweetElement(element: Element): any {
  // Look for author info within this tweet element
  const authorElement = element.querySelector('[data-testid="User-Name"]') ||
                       element.querySelector('[data-testid="UserName"]');
  
  const displayNameElement = authorElement?.querySelector('[dir="ltr"]') ||
                            authorElement?.querySelector('span');
  
  const usernameElement = authorElement?.querySelector('[role="link"]') ||
                         element.querySelector('a[href^="/"][href*="/"]');
  
  const avatarElement = element.querySelector('img[alt*="avatar"]') ||
                       element.querySelector('[data-testid="UserAvatar"] img') as HTMLImageElement;
  
  // Extract username from href
  let username = 'unknown';
  if (usernameElement) {
    const href = usernameElement.getAttribute('href');
    if (href) {
      const match = href.match(/^\/([^\/]+)/);
      if (match) username = match[1];
    }
  }
  
  const displayName = displayNameElement?.textContent?.trim() || username;
  
  // Look for verification badge
  const verifiedElement = element.querySelector('[data-testid="verifiedBadge"]') ||
                         element.querySelector('[aria-label*="verified"]');
  
  return {
    id: username,
    username,
    displayName,
    avatarUrl: avatarElement?.src,
    verified: !!verifiedElement,
    platform: 'twitter'
  };
}

/**
 * Click "Show more" and "Show replies" buttons to expand truncated content
 */
async function expandTruncatedContent(): Promise<void> {
  const expandButtons: HTMLElement[] = [];
  
  // Find "Show more" buttons for truncated tweets
  const showMoreButtons = document.querySelectorAll('[data-testid="tweet-text-show-more-link"]');
  expandButtons.push(...Array.from(showMoreButtons) as HTMLElement[]);
  
  // Find "Show replies" buttons
  const showRepliesButtons = document.querySelectorAll('[data-testid="showMore"]');
  expandButtons.push(...Array.from(showRepliesButtons) as HTMLElement[]);
  
  // Find buttons with "Show more" or "Show replies" in aria-label
  const ariaLabelButtons = document.querySelectorAll('[aria-label*="Show more"], [aria-label*="Show replies"]');
  expandButtons.push(...Array.from(ariaLabelButtons) as HTMLElement[]);
  
  // Find buttons and spans with "Show" text content
  const allButtons = document.querySelectorAll('button, span[role="button"], [role="button"]');
  for (const button of allButtons) {
    const text = button.textContent?.toLowerCase() || '';
    if (text.includes('show more') || text.includes('show replies') || text.includes('show this thread')) {
      expandButtons.push(button as HTMLElement);
    }
  }

  let clickedCount = 0;
  
  for (const button of expandButtons) {
    try {
      if (button && button.offsetParent !== null) {
        // Check if button is visible and clickable
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          button.click();
          clickedCount++;
          
          // Small delay between clicks to avoid overwhelming the page
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.warn('🐦 Failed to click expand button:', error);
    }
  }
  
  if (clickedCount > 0) {
    console.log(`🐦 Clicked ${clickedCount} expand buttons`);
    // Wait for content to load after clicking
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Get the current tweet count on the page (for progress tracking)
 */
export function getCurrentTweetCount(): number {
  const count = document.querySelectorAll('article[data-testid="tweet"]').length;
  return count;
} 