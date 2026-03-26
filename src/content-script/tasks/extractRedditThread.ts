import { normalizeUrl as cleanUrl } from '../../lib/utils/contentId';
import type { RedditThread, SocialMediaPost, SocialMediaUser, SocialMediaEngagement } from '../../types/socialMedia';

// Defuddle is loaded as a separate UMD script (defuddle.js) via manifest.json
declare const Defuddle: any;

export interface RedditExtractionResult {
  success: boolean;
  thread?: RedditThread;
  markdown?: string;
  error?: string;
  metadata?: {
    extractionMethod: string;
    processingTime: number;
    platformDetected: 'reddit';
  };
}

/**
 * Detect if the current page is a Reddit page
 */
export function isRedditPage(): boolean {
  const url = window.location.href;
  return /reddit\.com/i.test(url) || /old\.reddit\.com/i.test(url);
}

/**
 * Extract Reddit thread using defuddle's Reddit-specific extractor
 */
export async function extractRedditThread(): Promise<RedditExtractionResult> {
  const startTime = Date.now();

  try {
    if (!isRedditPage()) {
      return { success: false, error: 'Not a Reddit page' };
    }

    if (typeof Defuddle === 'undefined') {
      return { success: false, error: 'Defuddle not available' };
    }

    const currentUrl = window.location.href;
    const cleanedUrl = cleanUrl(currentUrl);

    console.log('🔴 Extracting Reddit thread via defuddle:', currentUrl);

    const defuddleInstance = new Defuddle(document, {
      markdown: true,
      url: currentUrl,
      useAsync: true,
      includeReplies: 'extractors',
    });

    // Try async first (Reddit extractor fetches old.reddit.com for better content)
    // Fall back to sync if async fetch fails (CORS in content script)
    let result: any;
    try {
      result = await defuddleInstance.parseAsync();
    } catch (asyncError) {
      console.warn('🔴 Defuddle async Reddit extraction failed, trying sync:', asyncError);
      result = defuddleInstance.parse();
    }

    if (!result.content || result.wordCount < 10) {
      return { success: false, error: 'Defuddle extracted insufficient Reddit content' };
    }

    const processingTime = Date.now() - startTime;

    console.log('🔴 Reddit extraction complete:', {
      extractorType: result.extractorType,
      wordCount: result.wordCount,
      hasVariables: !!result.variables,
      parseTime: result.parseTime,
    });

    // Extract subreddit from URL
    const subredditMatch = currentUrl.match(/reddit\.com\/r\/([^/]+)/);
    const subreddit = result.variables?.subreddit || subredditMatch?.[1] || 'unknown';

    // Build author from defuddle result
    const author: SocialMediaUser = {
      id: result.author || 'unknown',
      username: result.author || 'unknown',
      displayName: result.author || 'Unknown',
      platform: 'reddit',
    };

    // Build a root post from the defuddle content
    const emptyEngagement: SocialMediaEngagement = {
      likes: 0,
      reposts: 0,
      replies: 0,
    };

    const rootPost: SocialMediaPost = {
      id: cleanedUrl,
      text: result.contentMarkdown || result.content || '',
      htmlText: result.content,
      author: author,
      createdAt: result.published || new Date().toISOString(),
      engagement: emptyEngagement,
      url: cleanedUrl,
      isRoot: true,
      threadPosition: 0,
      section: 'main',
      platform: 'reddit',
    };

    // Build the thread
    const thread: RedditThread = {
      id: cleanedUrl,
      platform: 'reddit',
      url: cleanedUrl,
      title: result.title || document.title,
      description: result.description || '',
      rootPost: rootPost,
      posts: [rootPost],
      totalPosts: 1,
      author: author,
      totalEngagement: emptyEngagement,
      extractedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      isComplete: true,
      hasMoreReplies: false,
      quality: {
        score: 70,
        factors: {
          engagement: 50,
          authorCredibility: 50,
          contentDepth: result.wordCount > 200 ? 80 : 50,
          threadCohesion: 70,
        },
        reasons: ['Extracted via defuddle Reddit extractor'],
      },
      expansionPotential: {
        canExpand: false,
        estimatedAdditionalPosts: 0,
        expansionMethods: [],
        scrollRequired: false,
      },
      redditData: {
        subreddit: subreddit,
      },
    };

    return {
      success: true,
      thread,
      markdown: result.contentMarkdown || result.content,
      metadata: {
        extractionMethod: 'defuddle-reddit',
        processingTime,
        platformDetected: 'reddit',
      },
    };
  } catch (error) {
    console.error('🔴 Reddit extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Reddit extraction failed',
    };
  }
}
