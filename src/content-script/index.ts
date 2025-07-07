// Simplified content script - only handles content extraction when requested
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📄 Content script received message:', message);
  
  // Handle content extraction requests
  if (message.action === 'extractContent') {
    console.log('📄 Extracting content for:', window.location.href);
    
    try {
      const content = {
        url: window.location.href,
        text: document.body.innerText,
        html: document.documentElement.outerHTML,
        title: document.title,
        metadata: extractMetadata()
      };
      
      console.log('📄 Content extracted:', {
        url: content.url,
        textLength: content.text.length,
        htmlLength: content.html.length,
        title: content.title
      });
      
      sendResponse({ success: true, content });
    } catch (error) {
      console.error('📄 Content extraction failed:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Content extraction failed' 
      });
    }
    return true;
  }
  
  // Handle sidebar opened notification (for any cleanup if needed)
  if (message.action === 'sidebarOpened') {
    console.log('📄 Sidebar opened for this tab');
    sendResponse({ success: true });
    return true;
  }
  
  // Unknown message
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

function extractMetadata() {
  try {
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      author: document.querySelector('meta[name="author"]')?.getAttribute('content') || '',
      keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      lang: document.documentElement.lang || '',
      charset: document.characterSet || ''
    };
  } catch (error) {
    console.error('📄 Metadata extraction failed:', error);
    return {
      title: document.title,
      description: '',
      error: 'Metadata extraction failed'
    };
  }
}