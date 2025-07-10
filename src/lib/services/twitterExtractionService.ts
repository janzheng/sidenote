import type { 
  TwitterThread, 
  SocialMediaExtractionResponse,
  SocialMediaExpansionResponse,
  SocialMediaPost,
  SocialMediaUser,
  SocialMediaEngagement,
  SocialMediaPlatform
} from '../../types/socialMedia';
import type { TabData } from '../../types/tabData';

// Note: ScrollCapture functionality is handled by content scripts
// export { ScrollCapture, createTwitterScrollConfig } from '../content-script/tasks/scrollCapture';

export interface TwitterExtractionResult {
  success: boolean;
  thread?: TwitterThread;
  markdown?: string;
  progress?: {
    expandedCount: number;
    totalFound: number;
    currentStep: string;
  };
  error?: string;
}

export interface TwitterExtractionOptions {
  includeScrolling?: boolean;
  maxScrolls?: number;
  scrollDelay?: number;
  generateMarkdown?: boolean;
}

export class TwitterExtractionService {
  
  /**
   * Main extraction method that handles both basic and scroll-enhanced extraction
   */
  static async extractTwitterThread(
    tabData: TabData, 
    options: TwitterExtractionOptions = {}
  ): Promise<TwitterExtractionResult> {
    const {
      includeScrolling = true,
      maxScrolls = 100,
      scrollDelay = 300,
      generateMarkdown = true
    } = options;

    try {
      console.log('🐦 Starting unified Twitter thread extraction', { options });

      // Validate URL
      if (!this.isTwitterUrl(tabData.content?.url)) {
        return {
          success: false,
          error: 'URL is not from Twitter/X platform'
        };
      }

      let extractionResult: TwitterExtractionResult;

      if (includeScrolling) {
        // Use scroll-enhanced extraction for maximum content
        extractionResult = await this.extractWithScrolling(tabData, maxScrolls, scrollDelay);
      } else {
        // Use basic extraction from current content
        extractionResult = await this.extractBasic(tabData);
      }

      // Generate markdown if requested and extraction was successful
      if (generateMarkdown && extractionResult.success && extractionResult.thread) {
        extractionResult.markdown = this.generateMarkdown(extractionResult.thread);
      }

      return extractionResult;

    } catch (error) {
      console.error('❌ Unified Twitter extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract with scrolling for maximum content capture
   */
  private static async extractWithScrolling(
    tabData: TabData, 
    maxScrolls: number, 
    scrollDelay: number
  ): Promise<TwitterExtractionResult> {
    return new Promise((resolve) => {
             // Get tab ID from active tabs
       const tabIds = Array.from(tabData.meta.activeTabIds);
       const tabId = tabIds.length > 0 ? tabIds[0] : 0;
       
       // Send message to content script to perform scroll extraction
       chrome.tabs.sendMessage(tabId, {
        action: 'extractTwitterThreadWithScroll',
        maxScrolls,
        scrollDelay
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Content script communication error:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: 'Failed to communicate with content script. Please refresh the page.'
          });
          return;
        }

        if (response?.success) {
          resolve({
            success: true,
            thread: response.thread,
            progress: response.progress
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to extract Twitter thread with scrolling'
          });
        }
      });
    });
  }

  /**
   * Basic extraction from current page content
   */
  private static async extractBasic(tabData: TabData): Promise<TwitterExtractionResult> {
    return new Promise((resolve) => {
             // Get tab ID from active tabs
       const tabIds = Array.from(tabData.meta.activeTabIds);
       const tabId = tabIds.length > 0 ? tabIds[0] : 0;
       
       // Send message to content script to perform basic extraction
       chrome.tabs.sendMessage(tabId, {
        action: 'extractTwitterThread'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Content script communication error:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: 'Failed to communicate with content script. Please refresh the page.'
          });
          return;
        }

        if (response?.success) {
          resolve({
            success: true,
            thread: response.thread
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to extract Twitter thread'
          });
        }
      });
    });
  }

  /**
   * Generate markdown format with engagement metrics (like the old version)
   */
  static generateMarkdown(thread: TwitterThread): string {
    let markdown = `# Twitter Thread\n\n`;
    
    // Thread metadata
    markdown += `**URL:** ${thread.url}\n`;
    markdown += `**Extracted:** ${new Date(thread.extractedAt).toLocaleString()}\n`;
    markdown += `**Total Posts:** ${thread.posts.length}\n`;
    
    // Calculate total engagement
    const totalEngagement = thread.totalEngagement.likes + thread.totalEngagement.reposts + thread.totalEngagement.replies;
    if (totalEngagement > 0) {
      markdown += `**Total Engagement:** ${this.formatEngagement(totalEngagement)} (${this.formatEngagement(thread.totalEngagement.likes)} likes, ${this.formatEngagement(thread.totalEngagement.reposts)} retweets, ${this.formatEngagement(thread.totalEngagement.replies)} replies)\n`;
    }
    
    if (thread.totalEngagement.views && thread.totalEngagement.views > 0) {
      markdown += `**Total Views:** ${this.formatEngagement(thread.totalEngagement.views)}\n`;
    }
    
    markdown += `\n---\n\n`;

    // Root post
    if (thread.rootPost) {
      markdown += `## Original Tweet\n\n`;
      markdown += this.formatPostMarkdown(thread.rootPost, thread.author, true);
      markdown += `\n---\n\n`;
    }

    // Thread posts (replies, quotes, etc.)
    const threadPosts = thread.posts.filter(post => post.id !== thread.rootPost.id);
    
    if (threadPosts.length > 0) {
      markdown += `## Thread Posts (${threadPosts.length})\n\n`;
      
             threadPosts.forEach((post, index) => {
         const author = post.author;
         const postType = post.isRoot ? 'Root' : 'Reply'; // Simplified type detection
         markdown += `### ${index + 1}. ${postType}\n\n`;
         markdown += this.formatPostMarkdown(post, author, false);
         markdown += `\n`;
       });
    }

    // Quality assessment
    if (thread.quality && thread.quality.score > 0) {
      markdown += `\n---\n\n## Thread Quality\n\n`;
      markdown += `**Score:** ${thread.quality.score}/100\n`;
      if (thread.quality.reasons && thread.quality.reasons.length > 0) {
        markdown += `**Factors:** ${thread.quality.reasons.join(', ')}\n`;
      }
    }

    // Thread statistics
    markdown += `\n---\n\n## Statistics\n\n`;
    markdown += `- **Posts:** ${thread.posts.length}\n`;
         markdown += `- **Unique Authors:** ${new Set(thread.posts.map(p => p.author.id)).size}\n`;
     markdown += `- **Thread Depth:** ${Math.max(...thread.posts.map(p => p.threadPosition || 0))} levels\n`;
    
    if (thread.expansionPotential && !thread.expansionPotential.canExpand) {
      markdown += `- **Thread Status:** Complete\n`;
    } else if (thread.expansionPotential?.canExpand) {
      markdown += `- **Thread Status:** May have more content available\n`;
    }

    return markdown.trim();
  }

  /**
   * Format individual post for markdown
   */
  private static formatPostMarkdown(post: SocialMediaPost, author: SocialMediaUser, isRoot: boolean): string {
    let markdown = '';
    
    // Author info
    markdown += `**${author.displayName}**`;
    if (author.username) {
      markdown += ` (@${author.username.replace('@', '')})`;
    }
    if (author.verified) {
      markdown += ` ✓`;
    }
    markdown += `\n\n`;
    
    // Post content
    markdown += `${post.text}\n\n`;
    
    // Engagement metrics
    if (post.engagement) {
      const engagementParts = [];
      if (post.engagement.likes > 0) {
        engagementParts.push(`❤️ ${this.formatEngagement(post.engagement.likes)} likes`);
      }
      if (post.engagement.reposts > 0) {
        engagementParts.push(`🔄 ${this.formatEngagement(post.engagement.reposts)} retweets`);
      }
      if (post.engagement.replies > 0) {
        engagementParts.push(`💬 ${this.formatEngagement(post.engagement.replies)} replies`);
      }
      if (post.engagement.views && post.engagement.views > 0) {
        engagementParts.push(`👀 ${this.formatEngagement(post.engagement.views)} views`);
      }
      
      if (engagementParts.length > 0) {
        markdown += `*${engagementParts.join(' • ')}*\n\n`;
      }
    }
    
    // Timestamp and URL
    if (post.createdAt) {
      markdown += `*Posted: ${new Date(post.createdAt).toLocaleString()}*\n`;
    }
    if (post.url) {
      markdown += `*[View on Twitter](${post.url})*\n`;
    }
    
    // Media attachments
    if (post.images && post.images.length > 0) {
      markdown += `\n**Media:** ${post.images.length} image(s)\n`;
      post.images.forEach((image, index) => {
        markdown += `- ![Image ${index + 1}](${image.url})\n`;
      });
    }
    
    // Hashtags and mentions
    if (post.hashtags && post.hashtags.length > 0) {
      markdown += `\n**Hashtags:** ${post.hashtags.join(' ')}\n`;
    }
    if (post.mentions && post.mentions.length > 0) {
      markdown += `**Mentions:** ${post.mentions.join(' ')}\n`;
    }
    
    return markdown;
  }

  /**
   * Format engagement numbers (K, M notation)
   */
  private static formatEngagement(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Check if URL is from Twitter/X
   */
  static isTwitterUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return hostname.includes('twitter.com') || hostname.includes('x.com');
    } catch {
      return false;
    }
  }

  /**
   * Extract conversation ID from Twitter URL
   */
  static extractConversationId(url: string): string | null {
    try {
      const match = url.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate bookmark tags for Twitter threads
   */
  static generateBookmarkTags(thread: TwitterThread): string[] {
    const tags = ['twitter', 'thread'];
    
    // Add engagement-based tags
    const totalEngagement = thread.totalEngagement.likes + thread.totalEngagement.reposts + thread.totalEngagement.replies;
    if (totalEngagement > 10000) {
      tags.push('viral');
    } else if (totalEngagement > 1000) {
      tags.push('popular');
    }
    
    // Add quality-based tags
    if (thread.quality && thread.quality.score >= 80) {
      tags.push('high-quality');
    }
    
    // Add author-based tags
    if (thread.author.verified) {
      tags.push('verified-author');
    }
    
    // Add content-based tags
    if (thread.posts.length > 10) {
      tags.push('long-thread');
    }
    
    // Add hashtags from content (up to 3 most common)
    const allHashtags = thread.posts.flatMap(post => post.hashtags || []);
    const hashtagCounts = allHashtags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topHashtags = Object.entries(hashtagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([tag]) => tag.toLowerCase().replace('#', ''));
    
    tags.push(...topHashtags);
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Extract thread with the SocialMediaExtractionResponse format
   */
  static async extractThread(tabData: TabData): Promise<SocialMediaExtractionResponse> {
    const result = await this.extractTwitterThread(tabData, {
      includeScrolling: true,
      generateMarkdown: true
    });

    if (result.success && result.thread) {
             return {
         success: true,
         thread: result.thread,
         metadata: {
           extractionMethod: 'unified-twitter-service',
           processingTime: 0,
           platformDetected: 'twitter' as SocialMediaPlatform
         }
       };
     } else {
       return {
         success: false,
         error: result.error || 'Unknown error'
       };
    }
  }

  /**
   * Expand existing thread (placeholder for future implementation)
   */
  static async expandThread(url: string, currentThread: TwitterThread): Promise<SocialMediaExpansionResponse> {
    // For now, return the current thread as-is
    // TODO: Implement actual expansion logic
         return {
       success: true,
       additionalPosts: [],
       updatedThread: currentThread,
       progress: {
         expandedCount: 0,
         totalFound: currentThread.posts.length,
         currentStep: 'No additional expansion performed',
         isComplete: true
       }
     };
  }
} 