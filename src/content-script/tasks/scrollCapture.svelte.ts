/**
 * Generic scroll capture utility for social media and other content-heavy platforms
 * This can be reused for Twitter, LinkedIn, Instagram, etc.
 */

export interface ScrollCaptureConfig {
  // Content detection
  contentSelector: string; // Selector for main content elements to count
  stopConditions: {
    selectors: string[]; // Selectors that indicate we've reached the end
    texts: string[]; // Text content that indicates we've reached the end
  };
  
  // Scrolling behavior
  maxScrolls: number;
  scrollDelay: number;
  scrollStrategy: 'progressive' | 'fixed' | 'adaptive';
  
  // Scroll amounts
  initialScrollAmount: number; // For first few scrolls
  laterScrollAmount: number; // For later scrolls
  progressiveThreshold: number; // When to switch from initial to later amounts
  
  // Stability detection
  stableScrollThreshold: number; // How many scrolls with no progress before giving up
  contentStabilityWait: number; // How long to wait for content to load
  
  // Platform-specific settings
  platform: string;
  debug?: boolean;
}

export interface ScrollCaptureProgress {
  scrollCount: number;
  contentCount: number;
  currentStep: string;
  isComplete: boolean;
  stoppedReason?: 'max_scrolls' | 'stop_condition' | 'no_progress' | 'bottom_reached';
}

export interface ScrollCaptureResult {
  success: boolean;
  progress: ScrollCaptureProgress;
  error?: string;
  finalContentCount: number;
  totalScrolls: number;
}

/**
 * Generic scroll capture class that can be configured for different platforms
 */
export class ScrollCapture {
  private config: ScrollCaptureConfig;
  private isActive = false;
  private progress: ScrollCaptureProgress;
  private onProgressCallback?: (progress: ScrollCaptureProgress) => void | Promise<void>;

  constructor(config: ScrollCaptureConfig) {
    this.config = config;
    this.progress = {
      scrollCount: 0,
      contentCount: 0,
      currentStep: 'Initializing scroll capture...',
      isComplete: false
    };
  }

  /**
   * Set a progress callback to receive real-time updates
   */
  setProgressCallback(callback: (progress: ScrollCaptureProgress) => void | Promise<void>) {
    this.onProgressCallback = callback;
  }

  /**
   * Start the scroll capture process
   */
  async capture(): Promise<ScrollCaptureResult> {
    if (this.isActive) {
      throw new Error('Scroll capture is already active');
    }

    this.isActive = true;
    this.progress = {
      scrollCount: 0,
      contentCount: 0,
      currentStep: `Starting ${this.config.platform} scroll capture...`,
      isComplete: false
    };

    try {
      this.log('🔄 Starting scroll capture for platform:', this.config.platform);
      this.log('🔧 Scroll config:', {
        contentSelector: this.config.contentSelector,
        maxScrolls: this.config.maxScrolls,
        scrollDelay: this.config.scrollDelay,
        scrollStrategy: this.config.scrollStrategy,
        initialScrollAmount: this.config.initialScrollAmount,
        laterScrollAmount: this.config.laterScrollAmount
      });
      
      // STEP 1: Scroll to top
      await this.scrollToTop();
      
      // STEP 2: Get initial content count
      const initialContentCount = this.getContentCount();
      this.progress.contentCount = initialContentCount;
      this.progress.currentStep = `Initial content count: ${initialContentCount}`;
      await this.updateProgress();
      
      this.log(`📊 Initial content count: ${initialContentCount}`);
      
      // STEP 3: Progressive scrolling
      await this.performScrolling();
      
      // STEP 4: Skip final scroll to top to avoid double scrolling
      // The extraction will happen at the current position
      
      const finalContentCount = this.getContentCount();
      this.log(`🔄 Scroll capture complete. Final content count: ${finalContentCount}, total scrolls: ${this.progress.scrollCount}`);
      
      this.progress.isComplete = true;
      this.progress.currentStep = 'Scroll capture completed';
      await this.updateProgress();
      
      return {
        success: true,
        progress: this.progress,
        finalContentCount,
        totalScrolls: this.progress.scrollCount
      };

    } catch (error) {
      this.log('❌ Scroll capture failed:', error);
      return {
        success: false,
        progress: this.progress,
        error: error instanceof Error ? error.message : 'Unknown scroll capture error',
        finalContentCount: this.getContentCount(),
        totalScrolls: this.progress.scrollCount
      };
    } finally {
      this.isActive = false;
    }
  }

  /**
   * Stop the scroll capture process
   */
  stop() {
    this.isActive = false;
    this.log('🛑 Scroll capture stopped by request');
  }

  /**
   * Scroll to the absolute top of the page
   */
  private async scrollToTop(): Promise<void> {
    this.log('📍 Scrolling to absolute top...');
    
    // Force scroll to top using multiple methods
    window.scrollTo({ top: 0, behavior: 'instant' });
    await this.wait(500);
    
    // Double-check and force if needed
    if (window.pageYOffset > 0) {
      this.log('🔄 Still not at top, forcing with direct assignment');
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      await this.wait(300);
    }
    
    this.log(`📍 Current scroll position after top scroll: ${window.pageYOffset}`);
  }

  /**
   * Perform the main scrolling loop
   */
  private async performScrolling(): Promise<void> {
    this.log('📍 Starting progressive scroll down...');
    
    let previousContentCount = this.getContentCount();
    let stableScrollCount = 0;
    let lastScrollPosition = window.pageYOffset;
    
    this.log(`📊 Starting scroll loop with ${previousContentCount} initial items at position ${lastScrollPosition}`);
    
    while (this.progress.scrollCount < this.config.maxScrolls && this.isActive) {
      // Check stop conditions first
      if (this.checkStopConditions()) {
        this.progress.stoppedReason = 'stop_condition';
        this.log('🛑 Stop condition detected, ending scroll capture');
        break;
      }
      
      // Get current state BEFORE scrolling
      const currentContentCount = this.getContentCount();
      const currentScrollPosition = window.pageYOffset;
      
      this.log(`📊 Scroll ${this.progress.scrollCount + 1}/${this.config.maxScrolls}: Found ${currentContentCount} items, position: ${currentScrollPosition}`);
      
      // Check if we've reached the bottom before trying to scroll
      const hasReachedBottom = this.hasReachedBottom();
      if (hasReachedBottom) {
        this.log('📊 Reached bottom of page, doing final content check...');
        await this.wait(this.config.scrollDelay * 2);
        const finalContentCount = this.getContentCount();
        if (finalContentCount === currentContentCount) {
          this.progress.stoppedReason = 'bottom_reached';
          this.log('📊 Confirmed at bottom with no new content, stopping');
          break;
        } else {
          this.log(`📊 Found additional content at bottom: ${finalContentCount} vs ${currentContentCount}, continuing...`);
        }
      }
      
      // Perform scroll
      const scrollAmount = this.getScrollAmount();
      this.log(`📍 Scrolling by ${scrollAmount}px...`);
      
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      this.progress.scrollCount++;
      
      // Wait for content to load
      await this.wait(this.config.scrollDelay);
      
      // Check for new content after scroll
      const newContentCount = this.getContentCount();
      const newScrollPosition = window.pageYOffset;
      
      this.log(`📊 After scroll ${this.progress.scrollCount}: ${newContentCount} items, position: ${newScrollPosition}`);
      
      // Update progress
      this.progress.contentCount = newContentCount;
      this.progress.currentStep = `Scrolled ${this.progress.scrollCount} times, found ${newContentCount} items`;
      await this.updateProgress();
      
      // Check if we made progress (content or scroll position changed)
      const contentChanged = newContentCount > previousContentCount;
      const positionChanged = Math.abs(newScrollPosition - lastScrollPosition) > 10;
      
      if (contentChanged || positionChanged) {
        this.log(`📈 Progress made: content ${previousContentCount}→${newContentCount}, position ${lastScrollPosition}→${newScrollPosition}`);
        stableScrollCount = 0; // Reset stable count
        previousContentCount = newContentCount;
        lastScrollPosition = newScrollPosition;
      } else {
        stableScrollCount++;
        this.log(`⏸️ No progress: ${stableScrollCount}/${this.config.stableScrollThreshold} stable scrolls`);
        
        // Only give up if we've tried many times AND we're not making position progress
        if (stableScrollCount >= this.config.stableScrollThreshold) {
          // One final check - are we actually at the bottom?
          const finalBottomCheck = this.hasReachedBottom();
          if (finalBottomCheck) {
            this.progress.stoppedReason = 'bottom_reached';
            this.log('📊 No progress and confirmed at bottom, stopping');
            break;
          } else {
            // Not at bottom but no progress - might be a loading issue, try a few more
            if (stableScrollCount >= this.config.stableScrollThreshold * 2) {
              this.progress.stoppedReason = 'no_progress';
              this.log('📊 No progress for too long, giving up');
              break;
            } else {
              this.log('📊 No progress but not at bottom, continuing...');
            }
          }
        }
      }
    }
    
    if (this.progress.scrollCount >= this.config.maxScrolls) {
      this.progress.stoppedReason = 'max_scrolls';
      this.log('📊 Reached maximum scroll limit');
    }
    
    this.log(`📊 Scroll loop completed: ${this.progress.scrollCount} scrolls, reason: ${this.progress.stoppedReason}`);
  }

  /**
   * Get the current content count based on the configured selector
   */
  private getContentCount(): number {
    const count = document.querySelectorAll(this.config.contentSelector).length;
    this.log(`🔍 Content count for "${this.config.contentSelector}": ${count}`);
    return count;
  }

  /**
   * Check if any stop conditions are met
   */
  private checkStopConditions(): boolean {
    const viewportHeight = window.innerHeight;
    
    // Check for stop condition selectors
    for (const selector of this.config.stopConditions.selectors) {
      const elements = document.querySelectorAll(selector);
      this.log(`🔍 Checking stop selector "${selector}": found ${elements.length} elements`);
      
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.top >= 0 && rect.top <= viewportHeight) {
          this.log('🛑 Stop condition selector detected in viewport:', {
            selector,
            elementText: element.textContent?.substring(0, 100),
            position: { top: rect.top, bottom: rect.bottom }
          });
          return true;
        }
      }
    }
    
    // Check for stop condition texts
    for (const text of this.config.stopConditions.texts) {
      const element = this.findElementByText(document.documentElement, text);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.top >= 0 && rect.top <= viewportHeight) {
          this.log('🛑 Stop condition text detected in viewport:', {
            text,
            elementText: element.textContent?.substring(0, 100),
            position: { top: rect.top, bottom: rect.bottom }
          });
          return true;
        }
      }
    }
    
    this.log('✅ No stop conditions detected, continuing scroll...');
    return false;
  }

  /**
   * Get scroll amount based on the configured strategy
   */
  private getScrollAmount(): number {
    switch (this.config.scrollStrategy) {
      case 'progressive':
        return this.progress.scrollCount < this.config.progressiveThreshold
          ? this.config.initialScrollAmount
          : this.config.laterScrollAmount;
      
      case 'adaptive':
        // Adaptive strategy: smaller scrolls if content is being found, larger if not
        const recentProgress = this.progress.contentCount > 0;
        return recentProgress ? this.config.initialScrollAmount : this.config.laterScrollAmount;
      
      case 'fixed':
      default:
        return this.config.initialScrollAmount;
    }
  }

  /**
   * Check if we've reached the bottom of the page
   */
  private hasReachedBottom(): boolean {
    const scrollPosition = window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // More lenient bottom detection - need to be very close to bottom
    const isAtBottom = (scrollPosition + windowHeight) >= (documentHeight - 50);
    
    if (isAtBottom) {
      this.log(`📍 Bottom check: scrollPos=${scrollPosition}, windowHeight=${windowHeight}, docHeight=${documentHeight}, atBottom=${isAtBottom}`);
    }
    
    return isAtBottom;
  }

  /**
   * Find element by text content
   */
  private findElementByText(container: Element, searchText: string): Element | null {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent?.includes(searchText)) {
        return node.parentElement;
      }
    }
    return null;
  }

  /**
   * Wait for a specified amount of time
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update progress and call callback if set
   */
  private async updateProgress(): Promise<void> {
    if (this.onProgressCallback) {
      try {
        const result = this.onProgressCallback({ ...this.progress });
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        this.log('⚠️ Progress callback error:', error);
      }
    }
  }

  /**
   * Log message if debug is enabled
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log(`[ScrollCapture:${this.config.platform}]`, ...args);
    }
  }
}

/**
 * Create a Twitter-specific scroll capture configuration
 */
export function createTwitterScrollConfig(maxScrolls: number = 100, scrollDelay: number = 300): ScrollCaptureConfig {
  return {
    contentSelector: 'article[data-testid="tweet"]',
    stopConditions: {
      selectors: [
        // Very specific selectors that only appear at actual end states
        '[data-testid="error"]',
        '[data-testid="primaryColumn"] [data-testid="emptyState"]',
        '.error-page',
        '[data-testid="empty-state"]'
      ],
      texts: [
        // Only stop on actual error messages
        'Something went wrong. Try reloading.',
        'This Tweet was deleted by the Tweet author',
        'This account doesn\'t exist',
        'This Tweet is unavailable'
      ]
    },
    maxScrolls,
    scrollDelay,
    scrollStrategy: 'progressive',
    initialScrollAmount: window.innerHeight * 0.6, // More conservative initial scrolls
    laterScrollAmount: window.innerHeight * 0.8, // Conservative later scrolls
    progressiveThreshold: 8, // Switch to larger scrolls later
    stableScrollThreshold: 8, // Allow more scrolls without progress
    contentStabilityWait: 400, // Wait longer for content to load
    platform: 'twitter',
    debug: true
  };
}

/**
 * Create a LinkedIn-specific scroll capture configuration
 */
export function createLinkedInScrollConfig(maxScrolls: number = 50, scrollDelay: number = 400): ScrollCaptureConfig {
  return {
    contentSelector: '.feed-shared-update-v2',
    stopConditions: {
      selectors: [
        '.artdeco-empty-state',
        '.feed-follows-module'
      ],
      texts: [
        'You\'re all caught up',
        'No more posts',
        'Suggested for you'
      ]
    },
    maxScrolls,
    scrollDelay,
    scrollStrategy: 'fixed',
    initialScrollAmount: window.innerHeight * 0.8,
    laterScrollAmount: window.innerHeight * 0.8,
    progressiveThreshold: 0,
    stableScrollThreshold: 4,
    contentStabilityWait: 300,
    platform: 'linkedin',
    debug: true
  };
} 