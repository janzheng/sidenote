import { ScrollCapture, createTwitterScrollConfig, type ScrollCaptureProgress } from './scrollCapture.svelte';
import type { TwitterThread, SocialMediaPost, SocialMediaUser } from '../../types/socialMedia';

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

// Twitter-specific selectors for better content detection
const TWITTER_SELECTORS = {
  TWEETS: 'article[data-testid="tweet"]',
  TWEET_TEXT: '[data-testid="tweetText"]',
  MAIN_THREAD_CONTAINER: '[data-testid="primaryColumn"]',
  TIMELINE_CONTAINER: '[aria-label*="Timeline"]',
  USER_NAME: '[data-testid="User-Name"]',
  ENGAGEMENT_GROUP: '[role="group"]',
  // Sections to exclude
  DISCOVER_MORE_SECTION: '[data-testid="cellInnerDiv"]',
  SIDEBAR_CONTENT: '[data-testid="sidebarColumn"]',
  WHO_TO_FOLLOW: '[aria-label*="Who to follow"]'
};

export async function extractTwitterThreadWithScroll(
  maxScrolls: number = 150, // Increased from 100 to be more thorough 
  scrollDelay: number = 300
): Promise<{
  success: boolean;
  thread?: TwitterThread;
  progress?: any;
  error?: string;
}> {
  try {
    console.log('🐦 Starting enhanced Twitter thread extraction with comprehensive scrolling and expansion...');
    console.log('🐦 Parameters:', { maxScrolls, scrollDelay });
    console.log('🐦 Current URL:', window.location.href);

    // PHASE 1: Scroll to top and expand initial content
    console.log('🐦 Phase 1: Scrolling to top and expanding initial content...');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Expand initial content comprehensively
    await expandAllTwitterContent(50); // Initial expansion burst

    // PHASE 2: Collect all tweets during scrolling (with smart tracking to avoid re-processing)
    console.log('🐦 Phase 2: Collecting all tweets during scrolling...');
    const allExtractedTweets: ExtractedTweetData[] = [];
    const processedTweetIds = new Set<string>(); // Track which tweets we've already processed
    let domOrderCounter = 0;
    
    // Extract initial tweets
    const initialTweets = await extractNewTweetsFromDOM(domOrderCounter, processedTweetIds);
    allExtractedTweets.push(...initialTweets);
    domOrderCounter += initialTweets.length;
    
    console.log(`🐦 Initial extraction: ${initialTweets.length} tweets collected`);

    // PHASE 3: Scroll and extract with continuous expansion (only new tweets)
    console.log('🐦 Phase 3: Scrolling and extracting with comprehensive expansion...');
    
    const scrollConfig = createTwitterScrollConfig(maxScrolls, scrollDelay);
    const scrollCapture = new ScrollCapture(scrollConfig);
    
    let lastExtractedCount = initialTweets.length;
    let stableExtractionCount = 0;
    const maxStableExtractions = 12; // More patient than before (was 8)
    let totalExpansions = 0;
    
    // Set up progress callback with continuous extraction and expansion
    const progressCallback = async (progress: ScrollCaptureProgress) => {
      try {
        // Check if we've reached true end content (more lenient than before)
        if (hasReachedActualEndOfThread()) {
          console.log('🛑 Reached actual end of thread content, stopping scroll capture');
          scrollCapture.stop();
          return;
        }
        
        // First, expand any new content that appeared
        const expansionsThisCycle = await expandAllTwitterContent(10); // Reduced from 15 since we're more efficient now
        totalExpansions += expansionsThisCycle;
        
        // Extract ONLY new tweets that we haven't processed yet
        const beforeCount = allExtractedTweets.length;
        const newTweets = await extractNewTweetsFromDOM(domOrderCounter, processedTweetIds);
        allExtractedTweets.push(...newTweets);
        domOrderCounter += newTweets.length;
        const afterCount = allExtractedTweets.length;
        const newTweetsCount = afterCount - beforeCount;
        
        if (newTweetsCount > 0 || expansionsThisCycle > 0) {
          console.log(`🐦 Found ${newTweetsCount} NEW tweets and ${expansionsThisCycle} expansions during scroll (total collected: ${afterCount} tweets, ${totalExpansions} expansions)`);
          stableExtractionCount = 0;
          lastExtractedCount = afterCount;
        } else {
          stableExtractionCount++;
          console.log(`🐦 No new content found this cycle (${stableExtractionCount}/${maxStableExtractions}) - ${processedTweetIds.size} tweets already processed`);
        }
        
        // Stop scrolling if we haven't found new content for several cycles
        if (stableExtractionCount >= maxStableExtractions) {
          console.log('🐦 No new content found for several cycles, stopping scroll capture');
          scrollCapture.stop();
        }
        
        // Send progress update
        chrome.runtime.sendMessage({
          action: 'updateExtractionProgress',
          progress: {
            expandedCount: totalExpansions,
            totalFound: afterCount,
            currentStep: `Scrolled ${progress.scrollCount} times, expanded ${totalExpansions} elements, found ${newTweetsCount} new tweets (${afterCount} total)`
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
      totalCollectedTweets: allExtractedTweets.length,
      totalExpansions,
      processedTweetIds: processedTweetIds.size
    });

    // PHASE 4: Final extraction and deduplication
    console.log('🐦 Phase 4: Final extraction and deduplication...');
    
    // One final expansion and extraction to catch any remaining content
    const finalExpansions = await expandAllTwitterContent(50);
    totalExpansions += finalExpansions;
    const finalTweets = await extractNewTweetsFromDOM(domOrderCounter, processedTweetIds);
    allExtractedTweets.push(...finalTweets);
    
    const totalCollectedTweets = allExtractedTweets.length;
    console.log(`🐦 Total collected tweets: ${totalCollectedTweets}, total expansions: ${totalExpansions}, unique processed IDs: ${processedTweetIds.size}`);

    if (totalCollectedTweets === 0) {
      return {
        success: false,
        error: 'No tweets were captured during extraction',
        progress: {
          expandedCount: totalExpansions,
          totalFound: 0,
          currentStep: 'No tweets captured'
        }
      };
    }

    // PHASE 5: Light deduplication (should be minimal now)
    console.log('🐦 Phase 5: Final deduplication check...');
    const uniqueTweets = deduplicateTweets(allExtractedTweets);
    const duplicatesRemoved = totalCollectedTweets - uniqueTweets.length;
    console.log(`🐦 After final deduplication: ${uniqueTweets.length} unique tweets (removed ${duplicatesRemoved} duplicates - should be minimal)`);

    // PHASE 6: Build thread preserving display order
    console.log('🐦 Phase 6: Building thread with preserved order...');
    
    // Sort by DOM order to preserve Twitter's display ordering
    const sortedTweets = uniqueTweets.sort((a, b) => a.domOrder - b.domOrder);
    const allPosts = sortedTweets.map(tweet => tweet.post);
    
    // Use the first tweet as root (top of timeline)
    const rootPost = allPosts[0];
    
    // Extract author from the page or use the first post's author
    const author = extractAuthorFromDOM() || rootPost.author;

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
      totalExpansions,
      uniqueTweetsAfterDedup: uniqueTweets.length,
      duplicatesWereMinimal: duplicatesRemoved < 10,
      preservedOrder: true
    });

    return {
      success: true,
      thread: completeThread,
      progress: {
        expandedCount: totalExpansions,
        totalFound: completeThread.posts.length,
        currentStep: `Enhanced extraction completed: ${completeThread.posts.length} unique tweets with minimal revisiting`
      }
    };

  } catch (error) {
    console.error('❌ Enhanced Twitter thread extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Analyze page structure to identify content boundaries
 */
function analyzePageStructure(): {
  mainThreadContainer: Element | null;
  discoverMoreBoundary: Element | null;
  threadBoundaries: Element[];
  recommendationSections: Element[];
} {
  console.log('🔍 Analyzing Twitter page structure');
  
  // Get the main content area
  const mainColumn = document.querySelector(TWITTER_SELECTORS.MAIN_THREAD_CONTAINER);
  const timelineContainer = document.querySelector(TWITTER_SELECTORS.TIMELINE_CONTAINER);
  const mainThreadContainer = mainColumn || timelineContainer || document.body;
  
  console.log('📍 Main thread container:', mainThreadContainer?.tagName, mainThreadContainer?.getAttribute('data-testid'));
  
  // Find the "Discover more" boundary
  let discoverMoreBoundary: Element | null = null;
  
  // Look for explicit "Discover more" text
  const textElements = mainThreadContainer.querySelectorAll('*');
  for (const element of textElements) {
    const text = element.textContent || '';
    if (text.includes('Discover more') || text.includes('Sourced from across X')) {
      // Find the closest container that looks like a section boundary
      let container = element;
      while (container && container.parentElement) {
        if (container.getAttribute('data-testid') === 'cellInnerDiv' || 
            container.tagName === 'SECTION' ||
            container.getAttribute('role') === 'region') {
          discoverMoreBoundary = container;
          break;
        }
        container = container.parentElement;
      }
      if (discoverMoreBoundary) break;
    }
  }
  
  console.log('🛑 Discover more boundary:', discoverMoreBoundary?.tagName, discoverMoreBoundary?.textContent?.substring(0, 50));
  
  // Find thread boundaries
  const threadBoundaries: Element[] = [];
  const conversationThreads = mainThreadContainer.querySelectorAll('[aria-labelledby*="accessible-list"], [role="region"]');
  conversationThreads.forEach(thread => {
    if (!discoverMoreBoundary || !discoverMoreBoundary.contains(thread)) {
      threadBoundaries.push(thread);
    }
  });
  
  // Find recommendation sections to exclude
  const recommendationSections: Element[] = [];
  const sidebarContent = document.querySelectorAll(TWITTER_SELECTORS.SIDEBAR_CONTENT);
  const whoToFollow = document.querySelectorAll(TWITTER_SELECTORS.WHO_TO_FOLLOW);
  
  sidebarContent.forEach(section => recommendationSections.push(section));
  whoToFollow.forEach(section => recommendationSections.push(section));
  
  if (discoverMoreBoundary) {
    recommendationSections.push(discoverMoreBoundary);
  }
  
  console.log('📊 Structure analysis results:', {
    mainThreadContainer: !!mainThreadContainer,
    discoverMoreBoundary: !!discoverMoreBoundary,
    threadBoundaries: threadBoundaries.length,
    recommendationSections: recommendationSections.length
  });
  
  return {
    mainThreadContainer,
    discoverMoreBoundary,
    threadBoundaries,
    recommendationSections
  };
}

/**
 * Check if tweet is valid thread content (not recommendations)
 */
function isValidThreadTweet(tweetElement: HTMLElement, structureAnalysis: ReturnType<typeof analyzePageStructure>): boolean {
  // Check if tweet is in a recommendation section
  for (const recSection of structureAnalysis.recommendationSections) {
    if (recSection.contains(tweetElement)) {
      // Double-check: is this actually promotional content?
      const text = tweetElement.textContent || '';
      if (text.includes('Who to follow') || text.includes('Trending') || text.includes('Promoted')) {
        console.log('🚫 Tweet filtered: confirmed promotional content');
        return false;
      }
    }
  }
  
  // Check if tweet is after the discover more boundary
  if (structureAnalysis.discoverMoreBoundary) {
    const tweetRect = tweetElement.getBoundingClientRect();
    const boundaryRect = structureAnalysis.discoverMoreBoundary.getBoundingClientRect();
    
    // Filter if significantly after the boundary
    if (tweetRect.top > boundaryRect.bottom + 100) {
      console.log('🚫 Tweet filtered: well after discover more boundary');
      return false;
    }
  }
  
  // Filter out obvious promotional content
  const tweetText = tweetElement.textContent || '';
  const promotionalPatterns = [
    'Promoted Tweet',
    'Sponsored',
    'Advertisement',
    'Who to follow',
    'Trending in',
    'What\'s happening',
    'You might like these',
    'More Tweets'
  ];
  
  for (const pattern of promotionalPatterns) {
    if (tweetText.includes(pattern)) {
      console.log(`🚫 Tweet filtered: promotional content (${pattern})`);
      return false;
    }
  }
  
  // Basic content check: Must look like a tweet
  const hasTweetText = !!tweetElement.querySelector(TWITTER_SELECTORS.TWEET_TEXT);
  const hasUserName = !!tweetElement.querySelector(TWITTER_SELECTORS.USER_NAME);
  const hasTime = !!tweetElement.querySelector('time');
  
  if (!hasTweetText && !hasUserName && !hasTime) {
    console.log('🚫 Tweet filtered: no tweet-like content');
    return false;
  }
  
  return true;
}

/**
 * Check if we've reached the "Discover more" section
 */
function hasReachedDiscoverMoreSection(): boolean {
  // Look for text patterns that indicate we've reached recommendations
  const discoverMoreElement = findElementByText(document.documentElement, 'Discover more');
  const sourcedFromElement = findElementByText(document.documentElement, 'Sourced from across X');
  
  if (discoverMoreElement || sourcedFromElement) {
    console.log('🛑 Detected "Discover more" section - recommendation content');
    return true;
  }
  
  // Check for cells with data-testid="cellInnerDiv" that contain "Discover more"
  const cellInnerDivs = document.querySelectorAll('[data-testid="cellInnerDiv"]');
  for (const cell of cellInnerDivs) {
    if (cell.textContent?.includes('Discover more') || cell.textContent?.includes('Sourced from across X')) {
      console.log('🛑 Detected "Discover more" cell via data-testid');
      return true;
    }
  }
  
  return false;
}

/**
 * Check if we've reached the actual end of the thread content
 */
function hasReachedActualEndOfThread(): boolean {
  // Look for actual end-of-content indicators, not just recommendations
  const endIndicators = [
    'Something went wrong. Try reloading.',
    'This Tweet was deleted by the Tweet author',
    'This account doesn\'t exist',
    'This Tweet is unavailable',
    'End of conversation', // Twitter sometimes shows this
    'No more Tweets to show' // Another possible indicator
  ];
  
  // Check for error states or actual end messages
  for (const indicator of endIndicators) {
    if (document.body.textContent?.includes(indicator)) {
      console.log(`🛑 Detected actual end indicator: ${indicator}`);
      return true;
    }
  }
  
  // Check for error elements
  const errorElements = document.querySelectorAll([
    '[data-testid="error"]',
    '[data-testid="primaryColumn"] [data-testid="emptyState"]',
    '.error-page',
    '[data-testid="empty-state"]'
  ].join(', '));
  
  if (errorElements.length > 0) {
    console.log('🛑 Detected error elements indicating end of content');
    return true;
  }
  
  // Check if we're in a state where no new tweets are loading
  // Look for loading spinners - if none exist, we might be at the end
  const loadingElements = document.querySelectorAll([
    '[data-testid="spinner"]',
    '.loading',
    '[aria-label*="Loading"]'
  ].join(', '));
  
  // If we've scrolled significantly and there are no loading indicators,
  // and we haven't seen new tweets in a while, we might be at the end
  const currentTweetCount = document.querySelectorAll(TWITTER_SELECTORS.TWEETS).length;
  if (currentTweetCount > 50 && loadingElements.length === 0) {
    // This is a soft indicator - we'll let the stable extraction count handle this
    console.log('🟡 Possible end of content: many tweets loaded, no loading indicators');
  }
  
  return false;
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
 * Extract only NEW tweets from current DOM that haven't been processed yet
 */
async function extractNewTweetsFromDOM(
  startingDomOrder: number, 
  processedTweetIds: Set<string>
): Promise<ExtractedTweetData[]> {
  const tweetElements = document.querySelectorAll(TWITTER_SELECTORS.TWEETS);
  const extractedTweets: ExtractedTweetData[] = [];
  let domOrderCounter = startingDomOrder;
  
  for (const element of tweetElements) {
    try {
      const tweetElement = element as HTMLElement;
      
      // Quick check: get a fast identifier for this tweet to see if we've processed it
      const quickId = generateQuickTweetId(tweetElement);
      if (processedTweetIds.has(quickId)) {
        // Skip this tweet - we've already processed it
        continue;
      }
      
      // Apply structural filtering
      if (!isValidThreadTweet(tweetElement, analyzePageStructure())) {
        continue;
      }
      
      const tweetData = await extractSingleTweetWithIdentifier(tweetElement, domOrderCounter);
      if (tweetData) {
        // Mark this tweet as processed using multiple identifiers
        processedTweetIds.add(quickId);
        processedTweetIds.add(tweetData.identifier.id);
        processedTweetIds.add(tweetData.identifier.elementId);
        
        extractedTweets.push(tweetData);
        domOrderCounter++;
        
        console.log(`🐦 ✅ NEW tweet processed: ${tweetData.identifier.id} (DOM order: ${domOrderCounter - 1})`);
      }
    } catch (error) {
      console.warn('🐦 Failed to extract tweet:', error);
      domOrderCounter++;
    }
  }
  
  console.log(`🐦 📊 Processed ${extractedTweets.length} NEW tweets out of ${tweetElements.length} total tweets on page`);
  return extractedTweets;
}

/**
 * Generate a quick identifier for a tweet element to check if we've seen it before
 */
function generateQuickTweetId(element: HTMLElement): string {
  // Try to get tweet ID from URL first (most reliable)
  const linkElement = element.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
  if (linkElement?.href) {
    const match = linkElement.href.match(/\/status\/(\d+)/);
    if (match) return `url_${match[1]}`;
  }
  
  // Fallback: create a quick identifier based on position and some text
  const rect = element.getBoundingClientRect();
  const textContent = element.textContent?.substring(0, 100) || '';
  const quickHash = textContent.replace(/\s+/g, '').substring(0, 20);
  
  return `quick_${Math.round(rect.top)}_${Math.round(rect.left)}_${quickHash}`;
}

/**
 * Careful expansion of ONLY content expansion buttons (not reply buttons!)
 */
async function expandAllTwitterContent(maxExpansions: number = 15): Promise<number> {
  let clickedCount = 0;
  
  // ONLY TARGET ACTUAL CONTENT EXPANSION BUTTONS
  
  // 1. Tweet text "Show more" buttons (most important)
  const textShowMoreButtons = document.querySelectorAll([
    '[data-testid="tweet-text-show-more-link"]',
    'span[data-testid="tweet-text-show-more-link"]'
  ].join(', '));
  
  console.log(`🐦 Found ${textShowMoreButtons.length} "Show more" text buttons`);
  
  for (const button of textShowMoreButtons) {
    if (clickedCount >= maxExpansions) break;
    
    try {
      const buttonElement = button as HTMLElement;
      
      // Double-check this is actually a "Show more" button
      const buttonText = buttonElement.textContent?.toLowerCase() || '';
      if (!buttonText.includes('show more')) {
        console.log(`🐦 ⏭️ Skipping non-show-more button: "${buttonText}"`);
        continue;
      }
      
      // Check if button is visible and clickable
      const rect = buttonElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || buttonElement.offsetParent === null) {
        continue;
      }
      
      // Scroll into view and click
      buttonElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      buttonElement.click();
      clickedCount++;
      
      console.log(`🐦 ✅ Expanded tweet text ${clickedCount}: "${buttonText}"`);
      
      // Wait for content to expand
      await new Promise(resolve => setTimeout(resolve, 400));
      
    } catch (error) {
      console.warn('🐦 Failed to click show more button:', error);
    }
  }
  
  // 2. "Show this thread" buttons (if any exist)
  const showThreadButtons = document.querySelectorAll([
    'span[role="button"]'
  ].join(', '));
  
  for (const button of showThreadButtons) {
    if (clickedCount >= maxExpansions) break;
    
    try {
      const buttonElement = button as HTMLElement;
      const buttonText = buttonElement.textContent?.toLowerCase() || '';
      const ariaLabel = buttonElement.getAttribute('aria-label')?.toLowerCase() || '';
      
      // ONLY click if it's specifically about showing threads/conversations
      if (buttonText.includes('show this thread') || 
          buttonText.includes('show conversation') ||
          ariaLabel.includes('show this thread') ||
          ariaLabel.includes('show conversation')) {
        
        // Check if button is visible and clickable
        const rect = buttonElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || buttonElement.offsetParent === null) {
          continue;
        }
        
        buttonElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 200));
        
        buttonElement.click();
        clickedCount++;
        
        console.log(`🐦 ✅ Expanded thread ${clickedCount}: "${buttonText || ariaLabel}"`);
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
    } catch (error) {
      console.warn('🐦 Failed to click thread expansion button:', error);
    }
  }
  
  // 3. "Show more replies" or "Load more" buttons (very specific)
  const moreRepliesButtons = document.querySelectorAll([
    'button[aria-label*="Show more replies"]',
    'button[aria-label*="show more replies"]',
    'button[aria-label*="Load more"]',
    'button[aria-label*="load more"]'
  ].join(', '));
  
  console.log(`🐦 Found ${moreRepliesButtons.length} "Show more replies" buttons`);
  
  for (const button of moreRepliesButtons) {
    if (clickedCount >= maxExpansions) break;
    
    try {
      const buttonElement = button as HTMLElement;
      const ariaLabel = buttonElement.getAttribute('aria-label') || '';
      
      // Make sure it's not a reply button
      if (ariaLabel.toLowerCase().includes('reply to') || 
          ariaLabel.toLowerCase().includes('post your reply')) {
        console.log(`🐦 ⏭️ Skipping reply button: "${ariaLabel}"`);
        continue;
      }
      
      // Check if button is visible and clickable
      const rect = buttonElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || buttonElement.offsetParent === null) {
        continue;
      }
      
      buttonElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      buttonElement.click();
      clickedCount++;
      
      console.log(`🐦 ✅ Loaded more replies ${clickedCount}: "${ariaLabel}"`);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 600));
      
    } catch (error) {
      console.warn('🐦 Failed to click load more button:', error);
    }
  }
  
  if (clickedCount > 0) {
    console.log(`🐦 ✅ Successfully expanded ${clickedCount} content elements (NO reply boxes opened)`);
    // Extra wait for all content to load
    await new Promise(resolve => setTimeout(resolve, 800));
  } else {
    console.log(`🐦 ℹ️ No content expansion buttons found on this cycle`);
  }
  
  return clickedCount;
}

// Helper function to find elements by text content
function findElementByText(container: Element, searchText: string): Element | null {
  const elements = container.querySelectorAll('span, div, button');
  for (const element of elements) {
    if (element.textContent?.toLowerCase().includes(searchText.toLowerCase())) {
      return element;
    }
  }
  return null;
}

// Keep the existing helper functions for tweet extraction
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
    avatarUrl: (avatarElement as HTMLImageElement)?.src,
    verified: !!verifiedElement,
    platform: 'twitter'
  };
}

/**
 * Extract author information from the page
 */
function extractAuthorFromDOM(): SocialMediaUser | null {
  try {
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
  } catch (error) {
    console.warn('Failed to extract author from DOM:', error);
    return null;
  }
}

/**
 * Deduplicate tweets based on robust content-based matching
 */
function deduplicateTweets(tweets: ExtractedTweetData[]): ExtractedTweetData[] {
  const uniqueTweets = new Map<string, ExtractedTweetData>();
  
  for (const tweet of tweets) {
    const uniqueKey = generateUniqueKey(tweet.identifier);
    
    // If we've seen this tweet before, keep the one with the highest DOM order
    if (uniqueTweets.has(uniqueKey)) {
      const existingTweet = uniqueTweets.get(uniqueKey)!;
      if (tweet.domOrder > existingTweet.domOrder) {
        uniqueTweets.set(uniqueKey, tweet);
      }
    } else {
      uniqueTweets.set(uniqueKey, tweet);
    }
  }
  
  return Array.from(uniqueTweets.values());
}

/**
 * Get the current tweet count on the page (for progress tracking)
 */
export function getCurrentTweetCount(): number {
  const count = document.querySelectorAll('article[data-testid="tweet"]').length;
  return count;
} 