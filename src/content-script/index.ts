// Only listen for messages, don't auto-extract
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📄 Content script received message:', message);
  
  // Handle ping to check if content script is alive
  if (message.action === 'ping') {
    console.log('📄 Content script ping received');
    sendResponse({ success: true, message: 'Content script is alive' });
    return true;
  }
  
  if (message.action === 'extractContent') {
    console.log('📄 Extracting content...');
    
    // Only extract when requested
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
    return true;
  }
  
  if (message.action === 'sidebarOpened') {
    console.log('🎯 Sidebar opened');
    sendResponse({ success: true });
  } else if (message.action === 'sidebarClosed') {
    console.log('🎯 Sidebar closed - restoring UI elements');
    sendResponse({ success: true });
  }
});

function extractMetadata() {
  // Only run when needed
  return {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    // ... other metadata
  };
}