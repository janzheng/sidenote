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
/**
 * Extract translateY from inline style transform of a virtualized cell
 */
function getTranslateY(el: HTMLElement): number | null {
  const style = el.getAttribute('style') || '';
  // transform: translateY(1318px);
  const match = style.match(/translateY\(([-\d.]+)px\)/);
  if (match) {
    return parseFloat(match[1]);
  }
  // transform: translate3d(0px, 1318px, 0px)
  const match3d = style.match(/translate3d\([^,]+,\s*([-\d.]+)px,\s*[^)]+\)/);
  if (match3d) {
    return parseFloat(match3d[1]);
  }
  // Fallback: try computed style transform matrix
  const cs = window.getComputedStyle(el).transform;
  if (cs && cs !== 'none') {
    const m = cs.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*[-\d.]+,\s*([-\d.]+)\)/);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

function getElementVirtualYFromParents(el: HTMLElement): number | null {
  let current: HTMLElement | null = el;
  let steps = 0;
  while (current && steps < 8) {
    const y = getTranslateY(current);
    if (typeof y === 'number') return y;
    current = current.parentElement as HTMLElement | null;
    steps++;
  }
  return null;
}

/**
 * Find the earliest (smallest Y) Discover more cell within a container
 */
function findDiscoverMoreBoundaryY(container: Element): number | null {
  const cells = container.querySelectorAll('[data-testid="cellInnerDiv"]');
  let minY: number | null = null;
  cells.forEach((cell) => {
    const text = cell.textContent || '';
    if (text.includes('Discover more') || text.includes('Sourced from across X')) {
      const y = getTranslateY(cell as HTMLElement);
      if (typeof y === 'number') {
        if (minY === null || y < minY) {
          minY = y;
        }
      }
    }
  });
  return minY;
}

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
    const initialStructure = analyzePageStructure();
    const initialTweets = await extractNewTweetsFromDOM(domOrderCounter, processedTweetIds, initialStructure);
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
        const structureAnalysis = analyzePageStructure();
        const newTweets = await extractNewTweetsFromDOM(domOrderCounter, processedTweetIds, structureAnalysis);
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
    const finalStructure = analyzePageStructure();
    const finalTweets = await extractNewTweetsFromDOM(domOrderCounter, processedTweetIds, finalStructure);
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
  discoverMoreCell: Element | null;
  discoverMoreY: number | null;
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
  let discoverMoreCell: Element | null = null;
  let discoverMoreY: number | null = null;
  
  // Use virtualized cell translateY to find the boundary reliably
  discoverMoreY = findDiscoverMoreBoundaryY(mainThreadContainer);
  if (discoverMoreY !== null) {
    // Best-effort: pick the first matching cell as the boundary element
    const allCells = mainThreadContainer.querySelectorAll('[data-testid="cellInnerDiv"]');
    for (const cell of Array.from(allCells)) {
      const text = cell.textContent || '';
      if (text.includes('Discover more') || text.includes('Sourced from across X')) {
        const y = getTranslateY(cell as HTMLElement);
        if (typeof y === 'number' && y === discoverMoreY) {
          discoverMoreBoundary = cell;
          discoverMoreCell = cell;
          break;
        }
      }
    }
  }
  
  console.log('🛑 Discover more boundary:', discoverMoreBoundary?.tagName, discoverMoreBoundary?.textContent?.substring(0, 50));

  // Find recommendation sections to exclude
  const recommendationSections: Element[] = [];
  const sidebarContent = document.querySelectorAll(TWITTER_SELECTORS.SIDEBAR_CONTENT);
  const whoToFollow = document.querySelectorAll(TWITTER_SELECTORS.WHO_TO_FOLLOW);
  
  sidebarContent.forEach(section => recommendationSections.push(section));
  whoToFollow.forEach(section => recommendationSections.push(section));
  
  // Do not treat the main "Discover more" boundary as generic recommendations.
  // We'll classify tweets below it separately as 'discover_more'.
  
  console.log('📊 Structure analysis results:', {
    mainThreadContainer: !!mainThreadContainer,
    discoverMoreBoundary: !!discoverMoreBoundary,
    discoverMoreY,
    recommendationSections: recommendationSections.length
  });
  
  return {
    mainThreadContainer,
    discoverMoreBoundary,
    discoverMoreCell,
    discoverMoreY,
    recommendationSections
  };
}

/**
 * Check if tweet is valid thread content (not recommendations)
 */
function isValidThreadTweet(tweetElement: HTMLElement): boolean {
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
 * Classify a tweet element relative to page structure
 */
function classifyTweetSection(
  tweetElement: HTMLElement,
  structureAnalysis: ReturnType<typeof analyzePageStructure>
): 'main' | 'discover_more' | 'recommendations' {
  // Recommendation sections (sidebar, who to follow, explicit rec blocks)
  for (const recSection of structureAnalysis.recommendationSections) {
    if (recSection.contains(tweetElement)) {
      return 'recommendations';
    }
  }

  // Discover more boundary within main column using virtual list translateY
  if (structureAnalysis.discoverMoreY !== null || structureAnalysis.discoverMoreBoundary) {
    const tweetCell = tweetElement.closest('[data-testid="cellInnerDiv"]') as HTMLElement | null;
    // A034: Ensure tweetY always resolves to a number; fall back to getBoundingClientRect().top if virtual Y lookups return null
    const rawY = tweetCell ? (getTranslateY(tweetCell) ?? getElementVirtualYFromParents(tweetCell)) : getElementVirtualYFromParents(tweetElement);
    const tweetY = rawY ?? tweetElement.getBoundingClientRect().top;
    const boundaryY = structureAnalysis.discoverMoreY ?? structureAnalysis.discoverMoreBoundary?.getBoundingClientRect().bottom ?? null;
    if (boundaryY !== null && tweetY !== null && tweetY >= boundaryY) {
      try {
        const idLink = tweetElement.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
        const id = idLink?.href?.match(/\/status\/(\d+)/)?.[1] ?? 'unknown';
        console.log(`🔎 classifyTweetSection: tweet ${id} Y=${tweetY} >= boundaryY=${boundaryY} → discover_more`);
      } catch {}
      return 'discover_more';
    }
  }

  return 'main';
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
  processedTweetIds: Set<string>,
  structureAnalysis: ReturnType<typeof analyzePageStructure>
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
      if (!isValidThreadTweet(tweetElement)) {
        continue;
      }
      const section = classifyTweetSection(tweetElement, structureAnalysis);
      if (section === 'recommendations') {
        // Skip right rail/explicit recs
        continue;
      }
      
      const tweetData = await extractSingleTweetWithIdentifier(tweetElement, domOrderCounter, section);
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

  // Fallback: use content-based hash instead of position (which changes with scroll)
  // Use the tweet text + timestamp for a stable identifier
  const textContent = element.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || '';
  const timeEl = element.querySelector('time');
  const datetime = timeEl?.getAttribute('datetime') || '';
  const authorEl = element.querySelector('[data-testid="User-Name"]');
  const authorText = authorEl?.textContent?.trim().substring(0, 30) || '';

  // Create a stable hash from content, not position
  const hashInput = `${authorText}|${datetime}|${textContent.substring(0, 100)}`;
  const quickHash = createTextHash(hashInput);

  return `quick_${quickHash}`;
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
  domOrder: number,
  section: 'main' | 'discover_more' | 'recommendations'
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
      author,
      section,
      isDiscoverMore: section === 'discover_more'
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
  // Try to get existing ID
  const existingId = element.id;
  if (existingId) return existingId;

  // Try to use tweet status ID (stable across scrolls)
  const statusLink = element.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
  if (statusLink?.href) {
    const match = statusLink.href.match(/\/status\/(\d+)/);
    if (match) return `tweet_status_${match[1]}`;
  }

  // Fallback: use content-based hash (stable, not position-based)
  const textContent = element.textContent?.substring(0, 100) || '';
  const timeEl = element.querySelector('time');
  const datetime = timeEl?.getAttribute('datetime') || '';
  const textHash = createTextHash(`${datetime}|${textContent}`);

  return `tweet_${textHash}`;
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

  // Generate from timestamp and content hash (stable across scrolls)
  const timeElement = element.querySelector('time');
  const textContent = element.textContent?.substring(0, 150) || '';
  const contentHash = createTextHash(textContent);

  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      const timestamp = Date.parse(datetime);
      return `generated_${timestamp}_${contentHash}`;
    }
  }

  // Last resort: generate from content hash only
  return `generated_${contentHash}`;
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

  // Strategy 1: Look for the engagement group container first (most reliable)
  // X uses [role="group"] to wrap all engagement buttons
  const engagementGroup = element.querySelector('[role="group"]');
  const searchRoot = engagementGroup || element;

  // Strategy 2: Parse aria-labels from buttons within the group
  // X's current DOM uses aria-labels like "123 Likes", "45 replies", "67 reposts", "890 views"
  // or "Like" (for zero count), "Reply", "Repost", "123 Views"
  const engagementButtons = searchRoot.querySelectorAll('button[role="button"], [role="button"]');

  engagementButtons.forEach(button => {
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

    // Parse counts from aria-label which typically follows pattern: "123 likes" or "1,234 Likes"
    // Note: use aria-label as primary source since visible text may be abbreviated (1K, 2.3M)
    if (ariaLabel.includes('like') || ariaLabel.includes('unlike')) {
      engagement.likes = parseEngagementCount(ariaLabel);
    } else if (ariaLabel.includes('repost') || ariaLabel.includes('retweet')) {
      engagement.reposts = parseEngagementCount(ariaLabel);
    } else if (ariaLabel.includes('repl')) {
      engagement.replies = parseEngagementCount(ariaLabel);
    } else if (ariaLabel.includes('bookmark')) {
      // Skip bookmarks - not tracked in our engagement model
    } else if (ariaLabel.includes('view') || ariaLabel.includes('impression')) {
      engagement.views = parseEngagementCount(ariaLabel);
    }
  });

  // Strategy 3: Look for view count via analytics link
  // X sometimes shows views as a link like "1,234 Views" outside the button group
  if (engagement.views === 0) {
    const analyticsLinks = element.querySelectorAll('a[href*="/analytics"]');
    for (const link of analyticsLinks) {
      const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
      const text = link.textContent || '';
      if (ariaLabel.includes('view') || text.toLowerCase().includes('view')) {
        engagement.views = parseEngagementCount(ariaLabel || text);
        break;
      }
    }
  }

  // Strategy 4: Fallback - look for app-text-transition-container elements
  // These contain the visible numeric counts next to engagement buttons
  if (engagement.views === 0) {
    const transitionContainers = element.querySelectorAll('[data-testid="app-text-transition-container"]');
    // The last such container in the engagement group is sometimes the views counter
    // But we only use this if we haven't found views yet
    for (const container of transitionContainers) {
      const parent = container.closest('a[href*="/analytics"]');
      if (parent) {
        engagement.views = parseEngagementCount(container.textContent || '');
        break;
      }
    }
  }

  return engagement;
}

/**
 * Parse engagement count from text
 * Handles formats: "123", "1,234", "1.2K", "3.4M", "1,234 Likes", "12K views", etc.
 */
function parseEngagementCount(text: string): number {
  if (!text) return 0;

  // First try to match numbers with K/M/B suffix (e.g., "1.2K", "3.4M")
  const suffixMatch = text.match(/(\d+(?:[.,]\d+)?)\s*([KMB])/i);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1].replace(',', '.'));
    const suffix = suffixMatch[2].toUpperCase();
    switch (suffix) {
      case 'K': return Math.round(num * 1000);
      case 'M': return Math.round(num * 1000000);
      case 'B': return Math.round(num * 1000000000);
    }
  }

  // Then try comma-separated numbers (e.g., "1,234" or "1,234,567")
  const commaMatch = text.match(/(\d{1,3}(?:,\d{3})+)/);
  if (commaMatch) {
    return parseInt(commaMatch[1].replace(/,/g, ''), 10);
  }

  // Finally try plain numbers
  const plainMatch = text.match(/(\d+)/);
  if (plainMatch) {
    return parseInt(plainMatch[1], 10);
  }

  return 0;
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

      // Skip profile pictures, avatars, icons, and emoji images
      const isProfilePic = src.includes('profile_images') || src.includes('profile_banners');
      const isAvatar = alt.toLowerCase().includes('avatar') ||
                       img.closest('[data-testid="Tweet-User-Avatar"]') !== null ||
                       img.closest('[data-testid="UserAvatar"]') !== null;
      const isEmoji = src.includes('emoji') || src.includes('twemoji');
      const isIcon = (img.width > 0 && img.width < 30) || (img.height > 0 && img.height < 30);

      if (src && !isProfilePic && !isAvatar && !isEmoji && !isIcon) {
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

  // Extract username: look for the @handle link specifically
  // X's DOM has two links inside User-Name: display name and @handle
  // The @handle link's text starts with "@" or its href is a simple /<username> path
  let username = 'unknown';
  let displayName = '';

  if (authorElement) {
    // Strategy 1: Find all links inside User-Name and identify the @handle one
    const links = authorElement.querySelectorAll('a[role="link"]');
    for (const link of links) {
      const linkText = link.textContent?.trim() || '';
      const href = link.getAttribute('href') || '';

      // The @username link contains text starting with "@"
      if (linkText.startsWith('@')) {
        username = linkText.slice(1); // Remove the "@" prefix
        continue;
      }

      // The other link is typically the display name
      // Only set displayName from a link if it doesn't look like @username and is not empty
      if (linkText && !linkText.startsWith('@') && !displayName) {
        displayName = linkText;
      }
    }

    // Strategy 2: If we didn't find @handle via text, try href matching
    if (username === 'unknown') {
      const links = authorElement.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        // Match simple username paths like /username (no further slashes)
        const match = href.match(/^\/([A-Za-z0-9_]{1,15})$/);
        if (match) {
          username = match[1];
          break;
        }
      }
    }

    // Strategy 3: Look for spans with dir attribute for display name
    if (!displayName) {
      // Try multiple selectors for display name - X may use dir="ltr" or dir="auto" or just nested spans
      const nameSpan = authorElement.querySelector('a[role="link"] span') ||
                       authorElement.querySelector('[dir="ltr"] span') ||
                       authorElement.querySelector('[dir="auto"] span') ||
                       authorElement.querySelector('span');
      if (nameSpan) {
        const text = nameSpan.textContent?.trim() || '';
        if (text && !text.startsWith('@')) {
          displayName = text;
        }
      }
    }
  }

  // Fallback: extract username from any status link in the tweet
  if (username === 'unknown') {
    const statusLink = element.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
    if (statusLink?.href) {
      const match = statusLink.href.match(/\/([A-Za-z0-9_]{1,15})\/status\//);
      if (match) username = match[1];
    }
  }

  // Fallback: extract from time element's parent link (commonly wraps the timestamp)
  if (username === 'unknown') {
    const timeLink = element.querySelector('time')?.closest('a[href*="/status/"]');
    if (timeLink) {
      const href = timeLink.getAttribute('href') || '';
      const match = href.match(/\/([A-Za-z0-9_]{1,15})\/status\//);
      if (match) username = match[1];
    }
  }

  if (!displayName) {
    displayName = username;
  }

  const avatarElement = element.querySelector('[data-testid="Tweet-User-Avatar"] img') ||
                       element.querySelector('[data-testid="UserAvatar"] img') ||
                       element.querySelector('img[alt*="avatar"]') as HTMLImageElement;

  // Look for verification badge
  const verifiedElement = element.querySelector('[data-testid="icon-verified"]') ||
                         element.querySelector('[data-testid="verifiedBadge"]') ||
                         element.querySelector('svg[aria-label*="Verified"]') ||
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
 * Extract author information from the page (thread-level author).
 * On a tweet status page, the best source is the first tweet article
 * or the URL path itself.
 */
function extractAuthorFromDOM(): SocialMediaUser | null {
  try {
    // Strategy 1: Extract from the first tweet article on the page
    // This is the most reliable source on a /status/ page
    const firstTweet = document.querySelector('article[data-testid="tweet"]');
    if (firstTweet) {
      const tweetAuthor = extractAuthorFromTweetElement(firstTweet);
      if (tweetAuthor && tweetAuthor.username !== 'unknown') {
        // Also try to grab avatar from profile section if available
        const avatarElement = document.querySelector('[data-testid="Tweet-User-Avatar"] img') ||
                             document.querySelector('[data-testid="UserAvatar"] img') as HTMLImageElement;
        if (avatarElement) {
          tweetAuthor.avatarUrl = (avatarElement as HTMLImageElement)?.src;
        }
        return tweetAuthor;
      }
    }

    // Strategy 2: Extract username from the page URL
    const urlMatch = window.location.pathname.match(/^\/([A-Za-z0-9_]{1,15})/);
    const username = urlMatch?.[1] || 'unknown';

    // Strategy 3: Try to find display name from page-level User-Name elements
    let displayName = username;
    const userNameEl = document.querySelector('[data-testid="User-Name"]') ||
                       document.querySelector('[data-testid="UserName"]');
    if (userNameEl) {
      const nameSpan = userNameEl.querySelector('a[role="link"] span') ||
                       userNameEl.querySelector('[dir="ltr"] span') ||
                       userNameEl.querySelector('[dir="auto"] span') ||
                       userNameEl.querySelector('span');
      if (nameSpan) {
        const text = nameSpan.textContent?.trim() || '';
        if (text && !text.startsWith('@')) {
          displayName = text;
        }
      }
    }

    const avatarElement = document.querySelector('[data-testid="Tweet-User-Avatar"] img') ||
                         document.querySelector('[data-testid="UserAvatar"] img') as HTMLImageElement;

    // Look for verification badge
    const verifiedElement = document.querySelector('[data-testid="icon-verified"]') ||
                           document.querySelector('[data-testid="verifiedBadge"]') ||
                           document.querySelector('svg[aria-label*="Verified"]') ||
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