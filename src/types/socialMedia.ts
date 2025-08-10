// Universal Social Media Thread Types
// Supports Twitter, LinkedIn, Reddit, and other platforms

export type SocialMediaPlatform = 'twitter' | 'linkedin' | 'reddit' | 'mastodon' | 'bluesky' | 'threads' | 'unknown';

export interface SocialMediaUser {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  profileUrl?: string;
  verified?: boolean;
  followers?: number;
  following?: number;
  location?: string;
  website?: string;
  joinDate?: string;
  platform: SocialMediaPlatform;
  
  // Platform-specific user data
  platformSpecific?: {
    twitter?: {
      isBlueVerified?: boolean;
      isBusinessAccount?: boolean;
      tweetCount?: number;
    };
    linkedin?: {
      title?: string;
      company?: string;
      connectionDegree?: '1st' | '2nd' | '3rd' | 'Out of network';
      industry?: string;
      location?: string;
      isPremium?: boolean;
    };
    reddit?: {
      karma?: number;
      cakeDay?: string;
      isGold?: boolean;
    };
  };
}

export interface SocialMediaEngagement {
  likes: number;
  reposts: number; // retweets, shares, etc.
  replies: number;
  quotes?: number; // quote tweets/posts
  bookmarks?: number;
  views?: number;
}

export interface SocialMediaPost {
  id: string;
  text: string;
  htmlText?: string;
  author: SocialMediaUser;
  createdAt: string;
  engagement: SocialMediaEngagement;
  url: string;
  
  // Media attachments
  images?: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
  videos?: Array<{
    url: string;
    thumbnailUrl?: string;
    duration?: number;
    width?: number;
    height?: number;
  }>;
  
  // Thread context
  isRoot: boolean;
  parentId?: string;
  threadPosition?: number;
  
  // Section classification within page/thread
  // main: part of the main conversation; discover_more: below the "Discover more" boundary within the primary column;
  // recommendations: content from sidebars or explicit recommendation sections (e.g., Who to follow)
  section?: 'main' | 'discover_more' | 'recommendations';
  // Convenience flag for quickly checking if content is from the Discover more section
  isDiscoverMore?: boolean;
  
  // Platform-specific data
  platform: SocialMediaPlatform;
  platformData?: Record<string, any>;
  
  // Content analysis
  mentions?: string[];
  hashtags?: string[];
  urls?: string[];
  language?: string;
}

export interface SocialMediaThread {
  id: string;
  platform: SocialMediaPlatform;
  url: string;
  
  // Thread metadata
  title?: string;
  description?: string;
  rootPost: SocialMediaPost;
  posts: SocialMediaPost[];
  totalPosts: number;
  
  // Author info
  author: SocialMediaUser;
  
  // Engagement summary
  totalEngagement: SocialMediaEngagement;
  
  // Thread analysis
  topics?: string[];
  tags?: string[];
  summary?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  
  // Extraction metadata
  extractedAt: number;
  lastUpdatedAt: number;
  isComplete: boolean;
  hasMoreReplies: boolean;
  
  // Quality assessment
  quality: {
    score: number; // 0-100
    factors: {
      engagement: number;
      authorCredibility: number;
      contentDepth: number;
      threadCohesion: number;
    };
    reasons: string[];
  };
  
  // Expansion potential
  expansionPotential: {
    canExpand: boolean;
    estimatedAdditionalPosts: number;
    expansionMethods: string[];
    scrollRequired: boolean;
  };
}

// Platform-specific thread types
export interface TwitterThread extends SocialMediaThread {
  platform: 'twitter';
  conversationId?: string;
  threadType: 'main' | 'reply' | 'quote' | 'mixed';
  twitterData?: {
    spaceId?: string;
    communityId?: string;
    isPromoted?: boolean;
    restrictedReplies?: boolean;
  };
}

export interface LinkedInThread extends SocialMediaThread {
  platform: 'linkedin';
  linkedinData?: {
    companyPage?: boolean;
    articleUrl?: string;
    industryTags?: string[];
    professionalLevel?: string;
  };
  
  // Platform-specific thread data
  platformSpecific?: {
    linkedin?: {
      postType: 'feed' | 'article' | 'video' | 'document' | 'poll';
      isSponsored: boolean;
      targetAudience: string[];
      industryContext: string[];
      companyPages: string[];
      connectionInsights?: {
        mutualConnections: number;
        industryOverlap: number;
        companyOverlap: number;
      };
    };
  };
}

export interface RedditThread extends SocialMediaThread {
  platform: 'reddit';
  redditData?: {
    subreddit: string;
    flair?: string;
    isNSFW?: boolean;
    isLocked?: boolean;
    upvoteRatio?: number;
    awards?: Array<{
      name: string;
      count: number;
    }>;
  };
}

// Extraction and expansion responses
export interface SocialMediaExtractionResponse {
  success: boolean;
  thread?: SocialMediaThread;
  error?: string;
  metadata?: {
    extractionMethod: string;
    processingTime: number;
    platformDetected: SocialMediaPlatform;
  };
}

export interface SocialMediaExpansionResponse {
  success: boolean;
  additionalPosts?: SocialMediaPost[];
  updatedThread?: SocialMediaThread;
  error?: string;
  progress?: {
    expandedCount: number;
    totalFound: number;
    currentStep: string;
    isComplete: boolean;
  };
}

// Platform detection and validation
export interface PlatformDetectionResult {
  platform: SocialMediaPlatform;
  confidence: number; // 0-1
  indicators: string[];
  url: string;
  isSupported: boolean;
}

export interface ContentValidationResult {
  isValid: boolean;
  platform: SocialMediaPlatform;
  contentType: 'thread' | 'single_post' | 'profile' | 'search' | 'unknown';
  quality: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  extractable: boolean;
  reason?: string;
}

// Service interfaces
export interface SocialMediaExtractionOptions {
  includeReplies: boolean;
  maxPosts: number;
  expandThread: boolean;
  includeQuotes: boolean;
  includeMedia: boolean;
  analyzeContent: boolean;
}

export interface SocialMediaExpansionOptions {
  maxAdditionalPosts: number;
  scrollAttempts: number;
  waitTime: number;
  includeReplies: boolean;
  stopOnError: boolean;
}

// Twitter-specific utilities
export interface TwitterUrlInfo {
  isTwitterUrl: boolean;
  tweetId?: string;
  username?: string;
  conversationId?: string;
  urlType: 'tweet' | 'profile' | 'search' | 'list' | 'unknown';
}

export interface TwitterExtractionContext {
  url: string;
  tweetId?: string;
  conversationId?: string;
  username?: string;
  isMainTweet: boolean;
  hasThread: boolean;
  replyCount: number;
} 