import { ScrollCapture, createTwitterScrollConfig, type ScrollCaptureProgress } from './scrollCapture.svelte';
import { extractTwitterThread } from './extractTwitterThread.svelte';
import type { TwitterThread } from '../../types/socialMedia';

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
    console.log('🐦 Starting Twitter thread extraction with scrolling...');
    console.log('🐦 Parameters:', { maxScrolls, scrollDelay });
    console.log('🐦 Current URL:', window.location.href);
    console.log('🐦 Current hostname:', window.location.hostname);

    // Get initial tweet count
    const initialTweetCount = getCurrentTweetCount();
    console.log('🐦 Initial tweet count on page:', initialTweetCount);

    // Create scroll configuration
    const scrollConfig = createTwitterScrollConfig(maxScrolls, scrollDelay);
    console.log('🐦 Created scroll config:', scrollConfig);

    // PHASE 1: Extract initial tweets at the top
    console.log('🐦 Extracting initial tweets...');
    let allPosts: any[] = [];
    let seenTweetIds = new Set<string>();
    
    // Extract current tweets
    const initialExtractionResult = await extractTwitterThread();
    if (initialExtractionResult.success && initialExtractionResult.thread) {
      for (const post of initialExtractionResult.thread.posts) {
        if (!seenTweetIds.has(post.id)) {
          allPosts.push(post);
          seenTweetIds.add(post.id);
        }
      }
      console.log(`🐦 Initial extraction: ${allPosts.length} unique tweets`);
    }

    // PHASE 2: Scroll and extract continuously
    console.log('🔄 Starting scroll capture with continuous extraction...');
    
    const scrollCapture = new ScrollCapture(scrollConfig);
    
    // Set up progress callback that also extracts tweets
    const progressCallback = async (progress: ScrollCaptureProgress) => {
      // Extract tweets at current scroll position
      try {
        const currentExtractionResult = await extractTwitterThread();
        if (currentExtractionResult.success && currentExtractionResult.thread) {
          let newTweetsCount = 0;
          for (const post of currentExtractionResult.thread.posts) {
            if (!seenTweetIds.has(post.id)) {
              allPosts.push(post);
              seenTweetIds.add(post.id);
              newTweetsCount++;
            }
          }
          if (newTweetsCount > 0) {
            console.log(`🐦 Found ${newTweetsCount} new tweets during scroll (total: ${allPosts.length})`);
          }
        }
      } catch (error) {
        console.warn('🐦 Failed to extract tweets during scroll:', error);
      }
      
      console.log('🐦 Progress update:', {
        expandedCount: progress.scrollCount,
        totalFound: allPosts.length,
        currentStep: `${progress.currentStep} (${allPosts.length} tweets captured)`
      });
      
      // Send progress to background script
      chrome.runtime.sendMessage({
        action: 'updateExtractionProgress',
        progress: {
          expandedCount: progress.scrollCount,
          totalFound: allPosts.length,
          currentStep: `${progress.currentStep} (${allPosts.length} tweets captured)`
        }
      }).catch(() => {
        // Ignore errors - background script might not be ready
      });
    };

    scrollCapture.setProgressCallback(progressCallback);
    
    const scrollResult = await scrollCapture.capture();
    console.log('🔄 Scroll capture result:', scrollResult);
    
    if (!scrollResult.success) {
      return {
        success: false,
        error: scrollResult.error || 'Scroll capture failed',
        progress: {
          expandedCount: scrollResult.totalScrolls,
          totalFound: allPosts.length,
          currentStep: 'Scroll capture failed'
        }
      };
    }

    console.log('✅ Scroll capture completed:', {
      totalScrolls: scrollResult.totalScrolls,
      finalContentCount: scrollResult.finalContentCount,
      uniqueTweetsCaptured: allPosts.length,
      stoppedReason: scrollResult.progress.stoppedReason
    });

    // PHASE 3: Final extraction at the bottom
    console.log('🐦 Final extraction at bottom...');
    const finalExtractionResult = await extractTwitterThread();
    if (finalExtractionResult.success && finalExtractionResult.thread) {
      let finalNewTweetsCount = 0;
      for (const post of finalExtractionResult.thread.posts) {
        if (!seenTweetIds.has(post.id)) {
          allPosts.push(post);
          seenTweetIds.add(post.id);
          finalNewTweetsCount++;
        }
      }
      console.log(`🐦 Final extraction: ${finalNewTweetsCount} additional tweets (total: ${allPosts.length})`);
    }

    // PHASE 4: Build the complete thread from all captured posts
    if (allPosts.length === 0) {
      return {
        success: false,
        error: 'No tweets were captured during scrolling',
        progress: {
          expandedCount: scrollResult.totalScrolls,
          totalFound: 0,
          currentStep: 'No tweets captured'
        }
      };
    }

    // Sort posts by creation date to maintain chronological order
    allPosts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Build the complete thread using the first post as root
    const rootPost = allPosts[0];
    const author = initialExtractionResult.thread?.author || rootPost.author;

    // Calculate total engagement from all captured posts
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
      threadType: allPosts.length > 1 ? 'main' : 'main',
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

    console.log('✅ Complete Twitter thread built from scrolling:', {
      id: completeThread.id,
      posts: completeThread.posts.length,
      author: completeThread.author.username,
      totalScrolls: scrollResult.totalScrolls,
      uniqueTweetIds: seenTweetIds.size
    });

    return {
      success: true,
      thread: completeThread,
      progress: {
        expandedCount: scrollResult.totalScrolls,
        totalFound: completeThread.posts.length,
        currentStep: `Extraction completed successfully - ${completeThread.posts.length} tweets captured`
      }
    };

  } catch (error) {
    console.error('❌ Twitter thread extraction with scrolling failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during extraction',
      progress: {
        expandedCount: 0,
        totalFound: 0,
        currentStep: 'Extraction failed'
      }
    };
  }
}

/**
 * Get the current tweet count on the page (for progress tracking)
 */
export function getCurrentTweetCount(): number {
  const selector = 'article[data-testid="tweet"]';
  const count = document.querySelectorAll(selector).length;
  console.log('🐦 getCurrentTweetCount:', { selector, count });
  
  // Also check for alternative selectors if the main one doesn't work
  if (count === 0) {
    const altSelectors = [
      '[data-testid="tweet"]',
      'article[role="article"]',
      '.tweet',
      '[data-tweet-id]'
    ];
    
    for (const altSelector of altSelectors) {
      const altCount = document.querySelectorAll(altSelector).length;
      console.log('🐦 Alternative selector check:', { selector: altSelector, count: altCount });
      if (altCount > 0) {
        console.log('🐦 Found tweets with alternative selector:', altSelector);
        return altCount;
      }
    }
  }
  
  return count;
} 