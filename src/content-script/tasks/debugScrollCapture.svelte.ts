import { ScrollCapture, createTwitterScrollConfig } from './scrollCapture.svelte';

/**
 * Debug function to test scroll capture manually
 * This can be called from the browser console to test scrolling
 */
export async function debugScrollCapture(maxScrolls: number = 10, scrollDelay: number = 1000) {
  console.log('🔧 DEBUG: Starting scroll capture test...');
  console.log('🔧 Parameters:', { maxScrolls, scrollDelay });
  console.log('🔧 Current URL:', window.location.href);
  console.log('🔧 Window dimensions:', { 
    innerHeight: window.innerHeight, 
    innerWidth: window.innerWidth,
    scrollY: window.scrollY,
    documentHeight: document.documentElement.scrollHeight
  });
  
  // Test basic scrolling first
  console.log('🔧 Testing basic scroll...');
  const initialScrollPos = window.scrollY;
  window.scrollBy({ top: 100, behavior: 'smooth' });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  const afterScrollPos = window.scrollY;
  console.log('🔧 Basic scroll test:', { 
    initial: initialScrollPos, 
    after: afterScrollPos, 
    moved: afterScrollPos - initialScrollPos 
  });
  
  // Reset to top
  window.scrollTo({ top: 0, behavior: 'instant' });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test content detection
  const tweetSelector = 'article[data-testid="tweet"]';
  const initialTweetCount = document.querySelectorAll(tweetSelector).length;
  console.log('🔧 Initial tweet count:', initialTweetCount);
  
  // Test Twitter config
  const config = createTwitterScrollConfig(maxScrolls, scrollDelay);
  console.log('🔧 Twitter scroll config:', config);
  
  // Test scroll capture
  const scrollCapture = new ScrollCapture(config);
  
  // Set up progress logging
  scrollCapture.setProgressCallback((progress) => {
    console.log('🔧 Progress:', progress);
  });
  
  console.log('🔧 Starting scroll capture...');
  const result = await scrollCapture.capture();
  
  console.log('🔧 Scroll capture completed:', result);
  
  return result;
}

/**
 * Simple manual scroll test
 */
export async function debugManualScroll(scrollAmount: number = 500, steps: number = 5, delay: number = 1000) {
  console.log('🔧 DEBUG: Manual scroll test...');
  console.log('🔧 Parameters:', { scrollAmount, steps, delay });
  
  const results = [];
  
  for (let i = 0; i < steps; i++) {
    const beforePos = window.scrollY;
    const beforeTweets = document.querySelectorAll('article[data-testid="tweet"]').length;
    
    console.log(`🔧 Step ${i + 1}: Scrolling by ${scrollAmount}px from position ${beforePos}`);
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const afterPos = window.scrollY;
    const afterTweets = document.querySelectorAll('article[data-testid="tweet"]').length;
    
    const stepResult = {
      step: i + 1,
      beforePos,
      afterPos,
      moved: afterPos - beforePos,
      beforeTweets,
      afterTweets,
      newTweets: afterTweets - beforeTweets
    };
    
    console.log(`🔧 Step ${i + 1} result:`, stepResult);
    results.push(stepResult);
    
    // Stop if we can't scroll anymore
    if (stepResult.moved < 10) {
      console.log('🔧 Stopped scrolling - no movement detected');
      break;
    }
  }
  
  console.log('🔧 Manual scroll test completed:', results);
  return results;
}

/**
 * Test content detection with different selectors
 */
export function debugContentDetection() {
  console.log('🔧 DEBUG: Content detection test...');
  
  const selectors = [
    'article[data-testid="tweet"]',
    '[data-testid="tweet"]',
    'article[role="article"]',
    '.tweet',
    '[data-tweet-id]',
    'div[data-testid="cellInnerDiv"]',
    '[aria-label*="Timeline"]',
    'main[role="main"]'
  ];
  
  const results: Record<string, { count: number; sample?: string; error?: string }> = {};
  
  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      results[selector] = {
        count: elements.length,
        sample: elements.length > 0 ? elements[0].outerHTML.substring(0, 200) + '...' : undefined
      };
    } catch (error) {
      results[selector] = {
        count: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  
  console.log('🔧 Content detection results:', results);
  return results;
}

/**
 * Test what stop conditions are currently detected on the page
 */
function testStopConditions() {
  console.log('🔍 Testing current stop conditions on the page...');
  
  const config = createTwitterScrollConfig();
  const viewportHeight = window.innerHeight;
  
  console.log('📊 Viewport height:', viewportHeight);
  console.log('📊 Current scroll position:', window.pageYOffset);
  
  // Test selectors
  console.log('\n🔍 Testing stop condition selectors:');
  for (const selector of config.stopConditions.selectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`  "${selector}": ${elements.length} elements found`);
    
    if (elements.length > 0) {
      elements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const inViewport = rect.top >= 0 && rect.top <= viewportHeight;
        console.log(`    Element ${index + 1}:`, {
          inViewport,
          position: { top: rect.top, bottom: rect.bottom, height: rect.height },
          text: element.textContent?.substring(0, 100) + '...'
        });
      });
    }
  }
  
  // Test texts
  console.log('\n🔍 Testing stop condition texts:');
  for (const text of config.stopConditions.texts) {
    const element = findElementByText(document.documentElement, text);
    if (element) {
      const rect = element.getBoundingClientRect();
      const inViewport = rect.top >= 0 && rect.top <= viewportHeight;
      console.log(`  "${text}": found, inViewport: ${inViewport}`, {
        position: { top: rect.top, bottom: rect.bottom },
        elementText: element.textContent?.substring(0, 100) + '...'
      });
    } else {
      console.log(`  "${text}": not found`);
    }
  }
  
  console.log('\n📊 Current tweet count:', document.querySelectorAll('article[data-testid="tweet"]').length);
}

// Helper function for text search
function findElementByText(container: Element, searchText: string): Element | null {
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

// Make functions available globally for console testing
(window as any).debugScrollCapture = {
  testManualScroll: debugManualScroll,
  testContentDetection: debugContentDetection,
  testStepByStepScroll: debugScrollCapture,
  testStopConditions
}; 