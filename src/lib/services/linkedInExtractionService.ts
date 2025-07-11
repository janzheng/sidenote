import type { 
  LinkedInThread, 
  SocialMediaExtractionResponse,
  SocialMediaExpansionResponse,
  SocialMediaPost,
  SocialMediaUser,
  SocialMediaEngagement,
  SocialMediaPlatform
} from '../../types/socialMedia';
import type { TabData } from '../../types/tabData';

export interface LinkedInExtractionResult {
  success: boolean;
  thread?: LinkedInThread;
  markdown?: string;
  progress?: {
    expandedCount: number;
    totalFound: number;
    currentStep: string;
  };
  error?: string;
}

export interface LinkedInExtractionOptions {
  maxScrolls?: number;
  scrollDelay?: number;
  maxExpansions?: number;
  generateMarkdown?: boolean;
}

export class LinkedInExtractionService {
  
  /**
   * Main extraction method that always uses scroll-enhanced extraction for maximum content
   */
  static async extractLinkedInThread(
    tabData: TabData, 
    options: LinkedInExtractionOptions = {}
  ): Promise<LinkedInExtractionResult> {
    const {
      maxScrolls = 50,
      scrollDelay = 400,
      maxExpansions = 100,
      generateMarkdown = true
    } = options;

    try {
      console.log('🔗 Starting LinkedIn thread extraction with scrolling', { options });

      // Validate URL
      if (!this.isLinkedInUrl(tabData.content?.url)) {
        return {
          success: false,
          error: 'URL is not from LinkedIn platform'
        };
      }

      // Always use scroll-enhanced extraction for maximum content
      const extractionResult = await this.extractWithScrolling(tabData, maxScrolls, scrollDelay, maxExpansions);

      // Generate markdown if requested and extraction was successful
      if (generateMarkdown && extractionResult.success && extractionResult.thread) {
        extractionResult.markdown = this.generateMarkdown(extractionResult.thread);
      }

      return extractionResult;

    } catch (error) {
      console.error('❌ LinkedIn extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract with scrolling and expansion for maximum content capture
   */
  private static async extractWithScrolling(
    tabData: TabData, 
    maxScrolls: number, 
    scrollDelay: number,
    maxExpansions: number
  ): Promise<LinkedInExtractionResult> {
    return new Promise((resolve) => {
      // Get tab ID from active tabs
      const tabIds = Array.from(tabData.meta.activeTabIds);
      const tabId = tabIds.length > 0 ? tabIds[0] : 0;
      
      // Send message to content script to perform scroll extraction with expansion
      chrome.tabs.sendMessage(tabId, {
        action: 'extractLinkedInThreadWithScroll',
        maxScrolls,
        scrollDelay,
        maxExpansions
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
            error: response?.error || 'Failed to extract LinkedIn thread with scrolling'
          });
        }
      });
    });
  }

  /**
   * Generate markdown format with engagement metrics
   */
  static generateMarkdown(thread: LinkedInThread): string {
    let markdown = `# LinkedIn Thread\n\n`;
    
    // Thread metadata
    markdown += `**URL:** ${thread.url}\n`;
    markdown += `**Extracted:** ${new Date(thread.extractedAt).toLocaleString()}\n`;
    markdown += `**Total Posts:** ${thread.posts.length}\n`;
    
    // Calculate total engagement
    const totalEngagement = thread.totalEngagement.likes + thread.totalEngagement.reposts + thread.totalEngagement.replies;
    if (totalEngagement > 0) {
      markdown += `**Total Engagement:** ${this.formatEngagement(totalEngagement)} (${this.formatEngagement(thread.totalEngagement.likes)} reactions, ${this.formatEngagement(thread.totalEngagement.reposts)} shares, ${this.formatEngagement(thread.totalEngagement.replies)} comments)\n`;
    }
    
    if (thread.totalEngagement.views && thread.totalEngagement.views > 0) {
      markdown += `**Total Views:** ${this.formatEngagement(thread.totalEngagement.views)}\n`;
    }
    
    markdown += `\n---\n\n`;

    // Root post
    if (thread.rootPost) {
      markdown += `## Original Post\n\n`;
      markdown += this.formatPostMarkdown(thread.rootPost, thread.author, true);
      markdown += `\n---\n\n`;
    }

    // Thread posts (comments, replies, etc.)
    const threadPosts = thread.posts.filter(post => post.id !== thread.rootPost.id);
    
    if (threadPosts.length > 0) {
      markdown += `## Thread Posts (${threadPosts.length})\n\n`;
      
      threadPosts.forEach((post, index) => {
        const author = post.author;
        const postType = post.isRoot ? 'Root' : 'Comment';
        markdown += `### ${index + 1}. ${postType}\n\n`;
        markdown += this.formatPostMarkdown(post, author, false);
        markdown += `\n`;
      });
    }

    // LinkedIn-specific information
    if (thread.platformSpecific?.linkedin) {
      const linkedInData = thread.platformSpecific.linkedin;
      markdown += `\n---\n\n## LinkedIn Details\n\n`;
      markdown += `- **Post Type:** ${linkedInData.postType}\n`;
      if (linkedInData.isSponsored) {
        markdown += `- **Sponsored:** Yes\n`;
      }
      if (linkedInData.targetAudience && linkedInData.targetAudience.length > 0) {
        markdown += `- **Target Audience:** ${linkedInData.targetAudience.join(', ')}\n`;
      }
      if (linkedInData.industryContext && linkedInData.industryContext.length > 0) {
        markdown += `- **Industry Context:** ${linkedInData.industryContext.join(', ')}\n`;
      }
    }

    // Thread statistics
    markdown += `\n---\n\n## Statistics\n\n`;
    markdown += `- **Posts:** ${thread.posts.length}\n`;
    markdown += `- **Unique Authors:** ${new Set(thread.posts.map(p => p.author.id)).size}\n`;
    
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
    // LinkedIn-specific author info
    if (author.platformSpecific?.linkedin) {
      const linkedInUser = author.platformSpecific.linkedin;
      if (linkedInUser.title) {
        markdown += ` - ${linkedInUser.title}`;
      }
      if (linkedInUser.company) {
        markdown += ` at ${linkedInUser.company}`;
      }
      if (linkedInUser.connectionDegree) {
        markdown += ` (${linkedInUser.connectionDegree})`;
      }
    }
    markdown += `\n\n`;
    
    // Post content
    markdown += `${post.text}\n\n`;
    
    // Engagement metrics
    if (post.engagement) {
      const engagementParts = [];
      if (post.engagement.likes > 0) {
        engagementParts.push(`👍 ${this.formatEngagement(post.engagement.likes)} reactions`);
      }
      if (post.engagement.reposts > 0) {
        engagementParts.push(`🔄 ${this.formatEngagement(post.engagement.reposts)} shares`);
      }
      if (post.engagement.replies > 0) {
        engagementParts.push(`💬 ${this.formatEngagement(post.engagement.replies)} comments`);
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
      markdown += `*[View on LinkedIn](${post.url})*\n`;
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
   * Check if URL is from LinkedIn
   */
  static isLinkedInUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return hostname.includes('linkedin.com');
    } catch {
      return false;
    }
  }

  /**
   * Extract post ID from LinkedIn URL
   */
  static extractPostId(url: string): string | null {
    try {
      const match = url.match(/\/posts\/([^/?]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate bookmark tags for LinkedIn threads
   */
  static generateBookmarkTags(thread: LinkedInThread): string[] {
    const tags = ['linkedin', 'thread', 'professional'];
    
    // Add engagement-based tags
    const totalEngagement = thread.totalEngagement.likes + thread.totalEngagement.reposts + thread.totalEngagement.replies;
    if (totalEngagement > 1000) {
      tags.push('viral');
    } else if (totalEngagement > 100) {
      tags.push('popular');
    }
    
    // Add author-based tags
    if (thread.author.verified) {
      tags.push('verified-author');
    }
    
    // Add LinkedIn-specific tags
    if (thread.platformSpecific?.linkedin) {
      const linkedInData = thread.platformSpecific.linkedin;
      tags.push(linkedInData.postType);
      
      if (linkedInData.isSponsored) {
        tags.push('sponsored');
      }
      
      if (linkedInData.industryContext) {
        tags.push(...linkedInData.industryContext.slice(0, 3));
      }
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
    
    return [...new Set(tags)].slice(0, 15);
  }

  /**
   * Extract thread with the SocialMediaExtractionResponse format
   */
  static async extractThread(tabData: TabData): Promise<SocialMediaExtractionResponse> {
    const result = await this.extractLinkedInThread(tabData, {
      generateMarkdown: true
    });

    if (result.success && result.thread) {
      return {
        success: true,
        thread: result.thread,
        metadata: {
          extractionMethod: 'unified-linkedin-service',
          processingTime: 0,
          platformDetected: 'linkedin' as SocialMediaPlatform
        }
      };
    } else {
      return {
        success: false,
        error: result.error || 'Unknown error'
      };
    }
  }
} 