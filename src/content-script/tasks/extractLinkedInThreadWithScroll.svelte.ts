import { ScrollCapture, createLinkedInScrollConfig, type ScrollCaptureProgress } from './scrollCapture.svelte';
import { extractLinkedInThread } from './extractLinkedInThread.svelte';
import type { LinkedInThread, SocialMediaPost } from '../../types/socialMedia';

interface PostIdentifier {
  id: string;
  url: string;
  timestamp: string;
  textHash: string;
  domIndex: number;
  elementId: string;
}

interface ExtractedPostData {
  post: SocialMediaPost;
  identifier: PostIdentifier;
  domOrder: number;
  extractedAt: number;
}

export async function extractLinkedInThreadWithScroll(
  maxScrolls: number = 50, 
  scrollDelay: number = 400,
  maxExpansions: number = 100
): Promise<{
  success: boolean;
  thread?: LinkedInThread;
  progress?: any;
  error?: string;
}> {
  try {
    console.log('🔗 Starting enhanced LinkedIn thread extraction with scrolling and expansion...');
    console.log('🔗 Parameters:', { maxScrolls, scrollDelay, maxExpansions });
    console.log('🔗 Current URL:', window.location.href);

    // PHASE 1: Scroll to top and expand initial content
    console.log('🔗 Phase 1: Scrolling to top and expanding initial content...');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Expand initial truncated content
    await expandTruncatedContent(maxExpansions);

    // PHASE 2: Extract initial posts and set up deduplication
    console.log('🔗 Phase 2: Initial post extraction...');
    const postDatabase = new Map<string, ExtractedPostData>();
    let domOrderCounter = 0;
    
    // Extract initial posts
    await extractAndStorePosts(postDatabase, domOrderCounter);
    const initialCount = postDatabase.size;
    console.log(`🔗 Initial extraction: ${initialCount} unique posts`);

    // PHASE 3: Scroll and extract with continuous expansion
    console.log('🔗 Phase 3: Scrolling and extracting with expansion...');
    
    const scrollConfig = createLinkedInScrollConfig(maxScrolls, scrollDelay);
    const scrollCapture = new ScrollCapture(scrollConfig);
    
    let lastExtractedCount = initialCount;
    let stableExtractionCount = 0;
    const maxStableExtractions = 5; // Stop if no new posts for 5 scroll cycles
    let totalExpansions = 0;
    
    // Set up progress callback with continuous extraction and expansion
    const progressCallback = async (progress: ScrollCaptureProgress) => {
      try {
        // First, expand any new "see more" buttons that appeared
        const expansionsThisCycle = await expandTruncatedContent(10); // Limit per cycle
        totalExpansions += expansionsThisCycle;
        
        // Extract posts at current position
        const beforeCount = postDatabase.size;
        domOrderCounter = await extractAndStorePosts(postDatabase, domOrderCounter);
        const afterCount = postDatabase.size;
        const newPosts = afterCount - beforeCount;
        
        if (newPosts > 0 || expansionsThisCycle > 0) {
          console.log(`🔗 Found ${newPosts} new posts and ${expansionsThisCycle} expansions during scroll (total: ${afterCount} posts, ${totalExpansions} expansions)`);
          stableExtractionCount = 0;
          lastExtractedCount = afterCount;
        } else {
          stableExtractionCount++;
        }
        
        // Stop scrolling if we haven't found new content for several cycles
        if (stableExtractionCount >= maxStableExtractions) {
          console.log('🔗 No new content found for several cycles, stopping scroll capture');
          scrollCapture.stop();
        }
        
        // Send progress update
        chrome.runtime.sendMessage({
          action: 'updateExtractionProgress',
          progress: {
            expandedCount: totalExpansions,
            totalFound: afterCount,
            currentStep: `Scrolled ${progress.scrollCount} times, expanded ${totalExpansions} elements, found ${afterCount} posts (${newPosts} new)`
          }
        }).catch(() => {
          // Ignore errors - background script might not be ready
        });
        
      } catch (error) {
        console.warn('🔗 Error during scroll extraction:', error);
      }
    };

    scrollCapture.setProgressCallback(progressCallback);
    
    const scrollResult = await scrollCapture.capture();
    console.log('🔗 Scroll capture completed:', {
      success: scrollResult.success,
      totalScrolls: scrollResult.totalScrolls,
      stoppedReason: scrollResult.progress.stoppedReason,
      finalPostCount: postDatabase.size,
      totalExpansions
    });

    // PHASE 4: Final extraction and cleanup
    console.log('🔗 Phase 4: Final extraction and thread building...');
    
    // One final expansion and extraction to catch any remaining content
    const finalExpansions = await expandTruncatedContent(maxExpansions);
    totalExpansions += finalExpansions;
    await extractAndStorePosts(postDatabase, domOrderCounter);
    
    const finalPostCount = postDatabase.size;
    console.log(`🔗 Final post count: ${finalPostCount}, total expansions: ${totalExpansions}`);

    if (finalPostCount === 0) {
      return {
        success: false,
        error: 'No posts were captured during extraction',
        progress: {
          expandedCount: totalExpansions,
          totalFound: 0,
          currentStep: 'No posts captured'
        }
      };
    }

    // PHASE 5: Build thread preserving display order
    console.log('🔗 Phase 5: Building thread with preserved order...');
    
    // Sort by DOM order to preserve LinkedIn's display ordering
    const sortedPosts = Array.from(postDatabase.values())
      .sort((a, b) => a.domOrder - b.domOrder);
    
    const allPosts = sortedPosts.map(post => post.post);
    
    // Use the first post as root (top of timeline)
    const rootPost = allPosts[0];
    
    // Get author from initial extraction or first post
    const initialExtractionResult = await extractLinkedInThread();
    const author = initialExtractionResult.thread?.author || rootPost.author;

    // Calculate total engagement
    const totalEngagement = allPosts.reduce((total, post) => ({
      likes: total.likes + post.engagement.likes,
      reposts: total.reposts + post.engagement.reposts,
      replies: total.replies + post.engagement.replies,
      views: total.views + (post.engagement.views || 0)
    }), { likes: 0, reposts: 0, replies: 0, views: 0 });

    const completeThread: LinkedInThread = {
      id: rootPost.id,
      platform: 'linkedin',
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
      },
      platformSpecific: {
        linkedin: {
          postType: 'feed',
          isSponsored: false,
          targetAudience: [],
          industryContext: [],
          companyPages: []
        }
      }
    };

    console.log('✅ Enhanced LinkedIn thread extraction completed:', {
      id: completeThread.id,
      posts: completeThread.posts.length,
      author: completeThread.author.username,
      totalScrolls: scrollResult.totalScrolls,
      totalExpansions,
      uniquePostIds: postDatabase.size,
      preservedOrder: true
    });

    return {
      success: true,
      thread: completeThread,
      progress: {
        expandedCount: totalExpansions,
        totalFound: completeThread.posts.length,
        currentStep: `Enhanced extraction completed - ${completeThread.posts.length} posts captured with ${totalExpansions} expansions in display order`
      }
    };

  } catch (error) {
    console.error('❌ Enhanced LinkedIn thread extraction failed:', error);
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
 * Extract posts from current DOM and store with bulletproof deduplication
 */
async function extractAndStorePosts(
  postDatabase: Map<string, ExtractedPostData>,
  startingDomOrder: number
): Promise<number> {
  const postElements = document.querySelectorAll('.feed-shared-update-v2, .feed-shared-article, .comments-comment-entity, article[data-id]');
  let domOrderCounter = startingDomOrder;
  
  for (const element of postElements) {
    try {
      const postData = await extractSinglePostWithIdentifier(element, domOrderCounter);
      if (postData) {
        const uniqueKey = generateUniqueKey(postData.identifier);
        
        // Only store if we haven't seen this exact post before
        if (!postDatabase.has(uniqueKey)) {
          postDatabase.set(uniqueKey, postData);
          console.log(`🔗 Stored new post: ${postData.identifier.id} (DOM order: ${domOrderCounter})`);
        }
        
        domOrderCounter++;
      }
    } catch (error) {
      console.warn('🔗 Failed to extract post:', error);
      domOrderCounter++;
    }
  }
  
  return domOrderCounter;
}

/**
 * Extract a single post with comprehensive identifier for deduplication
 */
async function extractSinglePostWithIdentifier(
  element: Element,
  domOrder: number
): Promise<ExtractedPostData | null> {
  try {
    // Generate a unique element ID for this DOM element
    const elementId = generateElementId(element);
    
    // Extract basic post data
    const postId = extractPostId(element);
    if (!postId) return null;

    const textElement = element.querySelector('.feed-shared-update-v2__description, .comments-comment-item__main-content, .update-components-text') ||
                       element.querySelector('[lang]') ||
                       element.querySelector('div[dir="auto"]');
    
    const text = textElement?.textContent?.trim() || '';
    
    // Create text hash for deduplication
    const textHash = createTextHash(text);
    
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

    // Extract author for this specific post
    const author = extractAuthorFromPostElement(element);

    const identifier: PostIdentifier = {
      id: postId,
      url,
      timestamp: createdAt,
      textHash,
      domIndex: domOrder,
      elementId
    };

    const post: SocialMediaPost = {
      id: postId,
      text,
      author,
      createdAt,
      engagement,
      images,
      hashtags,
      mentions,
      isRoot: domOrder === 0,
      platform: 'linkedin',
      url
    };

    return {
      post,
      identifier,
      domOrder,
      extractedAt: Date.now()
    };

  } catch (error) {
    console.error('Error extracting post with identifier:', error);
    return null;
  }
}

/**
 * Expand truncated content by clicking "see more" buttons and loading more comments
 */
async function expandTruncatedContent(maxExpansions: number = 100): Promise<number> {
  const expandButtons: HTMLElement[] = [];
  let clickedCount = 0;
  
  // HIGH PRIORITY: Main comment loading buttons (expand threads first)
  const commentLoadButtons = document.querySelectorAll([
    'button[aria-label*="Load more comments"]',
    'button[aria-label*="load more comments"]',
    '.comments-comment-list__load-more-container button',
    '.comments-comments-list__load-more-comments-button--cr',
    '.comments-comments-list__load-more-comments-arrows',
    '.comments-comments-list__load-more-comments-button',
    'button[data-test-id="load-more-comments"]',
    'button[data-control-name="load_more_comments"]'
  ].join(', '));
  
  expandButtons.push(...Array.from(commentLoadButtons) as HTMLElement[]);
  
  // MEDIUM PRIORITY: "See more" text expansion buttons
  const seeMoreButtons = document.querySelectorAll([
    '[data-test-id="show-more-text"]',
    '.feed-shared-inline-show-more-text__see-more-less-toggle',
    '.show-more-less-text__more-link',
    '.show-more-less-text__more-button',
    '.feed-shared-update-v2__description-wrapper button',
    'button[aria-label*="see more"]',
    'button[aria-label*="See more"]',
    'button[data-control-name="see_more_text"]',
    '.truncate-multiline__expand-link'
  ].join(', '));
  
  expandButtons.push(...Array.from(seeMoreButtons) as HTMLElement[]);
  
  // LOW PRIORITY: Reply thread expansion
  const replyButtons = document.querySelectorAll([
    'button[aria-label*="See previous replies"]',
    'button[aria-label*="see previous replies"]',
    'button[aria-label*="Show previous replies"]',
    'button[aria-label*="show previous replies"]',
    '.comments-comment-item__replies-list button',
    'button[data-control-name="show_previous_replies"]'
  ].join(', '));
  
  expandButtons.push(...Array.from(replyButtons) as HTMLElement[]);
  
  // SPECIAL: Look for buttons with text content containing expansion keywords
  const allButtons = document.querySelectorAll('button, span[role="button"], [role="button"]');
  for (const button of allButtons) {
    const text = button.textContent?.toLowerCase() || '';
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    
    if (text.includes('load more') || text.includes('see more') || text.includes('show more') ||
        text.includes('see previous') || text.includes('show previous') ||
        ariaLabel.includes('load more') || ariaLabel.includes('see more') || ariaLabel.includes('show more')) {
      expandButtons.push(button as HTMLElement);
    }
  }
  
  // Remove duplicates and filter for visible, clickable elements
  const uniqueButtons = [...new Set(expandButtons)].filter(element => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && 
           style.display !== 'none' && style.visibility !== 'hidden' &&
           !element.hasAttribute('disabled') &&
           element.offsetParent !== null;
  });
  
  console.log(`🔗 Found ${uniqueButtons.length} expandable buttons`);
  
  // Click buttons with delays, prioritizing comment loading
  for (const button of uniqueButtons) {
    if (clickedCount >= maxExpansions) break;
    
    try {
      // Scroll button into view
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Click the button
      button.click();
      clickedCount++;
      
      console.log(`🔗 Clicked expansion button ${clickedCount}: ${button.textContent?.trim() || button.getAttribute('aria-label') || 'Unknown button'}`);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 600));
      
    } catch (error) {
      console.warn('🔗 Failed to click expand button:', error);
    }
  }
  
  if (clickedCount > 0) {
    console.log(`🔗 Clicked ${clickedCount} expansion buttons, waiting for content to load...`);
    // Extra wait for all content to load
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return clickedCount;
}

/**
 * Generate a unique key for deduplication using multiple identifiers
 */
function generateUniqueKey(identifier: PostIdentifier): string {
  // Use multiple identifiers to create a bulletproof unique key
  const keyParts = [
    identifier.id,
    identifier.textHash,
    identifier.timestamp,
    identifier.url.split('/').pop() || '' // Post ID from URL
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
  
  return `linkedin_post_${rect.top}_${rect.left}_${textHash}`;
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
 * Helper functions from extractLinkedInThread.svelte.ts
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

  // Generate from timestamp and position
  const timeElement = element.querySelector('time');
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      const timestamp = Date.parse(datetime);
      const rect = element.getBoundingClientRect();
      return `linkedin_generated_${timestamp}_${Math.round(rect.top)}`;
    }
  }

  // Last resort: generate from position and content
  const rect = element.getBoundingClientRect();
  const textContent = element.textContent?.substring(0, 100) || '';
  const contentHash = createTextHash(textContent);
  return `linkedin_generated_${Math.round(rect.top)}_${contentHash}`;
}

function extractEngagementFromElement(element: Element): any {
  const engagement = {
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

function extractImagesFromElement(element: Element): any[] {
  const images: any[] = [];
  const imageElements = element.querySelectorAll('img[src]');
  
  imageElements.forEach(img => {
    if (img instanceof HTMLImageElement) {
      const src = img.src;
      const alt = img.alt || '';
      
      // Skip profile pictures and small icons
      if (src && !src.includes('profile-displayphoto') && 
          !src.includes('company-logo') && !alt.includes('avatar') &&
          img.naturalWidth > 100) {
        images.push({
          url: src,
          alt: alt
        });
      }
    }
  });
  
  return images;
}

function extractHashtagsFromText(text: string): string[] {
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags;
}

function extractMentionsFromText(text: string): string[] {
  const mentions = text.match(/@[\w-]+/g) || [];
  return mentions;
}

function extractAuthorFromPostElement(element: Element): any {
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

  return {
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
}

function extractUsernameFromUrl(url: string): string {
  const match = url.match(/\/in\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

function extractConnectionDegree(element: Element | null): '1st' | '2nd' | '3rd' | 'Out of network' | undefined {
  if (!element) return undefined;
  
  const text = element.textContent?.toLowerCase() || '';
  if (text.includes('1st')) return '1st';
  if (text.includes('2nd')) return '2nd';
  if (text.includes('3rd')) return '3rd';
  return undefined;
}

function extractCompany(title: string): string | undefined {
  const atMatch = title.match(/\s+at\s+(.+?)(?:\s+\||$)/i);
  if (atMatch) return atMatch[1].trim();
  
  const companyMatch = title.match(/,\s*(.+?)(?:\s+\||$)/);
  if (companyMatch) return companyMatch[1].trim();
  
  return undefined;
}

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
 * Get the current post count on the page (for progress tracking)
 */
export function getCurrentLinkedInPostCount(): number {
  const count = document.querySelectorAll('.feed-shared-update-v2, .feed-shared-article, .comments-comment-entity').length;
  return count;
} 