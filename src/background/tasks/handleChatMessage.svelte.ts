import type { TabData } from '../../types/tabData';
import type { ChatMessage } from '../../types/chatMessage';
import { backgroundDataController } from '../index';
import { ChatService } from '../../lib/services/chatService.svelte';

/**
 * Handle chat message request for a specific URL
 */
export async function handleChatMessage(url: string, message: string, chatHistory: ChatMessage[], sendResponse: (response: any) => void) {
  try {
    console.log('💬 Starting chat message processing for URL:', url);

    // First, load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      });
      return;
    }

    // Check if we have content to chat about
    if (!tabData.content?.text || tabData.content.text.trim().length === 0) {
      console.error('❌ No text content found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No text content available to chat about.' 
      });
      return;
    }

    // ✅ NEW: Only specify the fields we want to update!
    await backgroundDataController.saveData(url, {
      processing: {
        chat: { isGenerating: true, error: null }
      }
    });

    console.log('💬 Sending message to ChatService...');
    
    // Use ChatService to generate response
    const chatResult = await ChatService.sendMessage(tabData, message, chatHistory);

    if (chatResult.success && chatResult.messages) {
      console.log('✅ Chat response generated successfully');
      
      // ✅ NEW: Only specify the fields we want to update!
      await backgroundDataController.saveData(url, {
        analysis: {
          chatMessages: chatResult.messages
        },
        processing: {
          chat: { isGenerating: false, error: null }
        }
      });

      sendResponse({ 
        success: true, 
        message: chatResult.message,
        messages: chatResult.messages
      });
    } else {
      console.error('❌ Chat message generation failed:', chatResult.error);
      
      // ✅ NEW: Only specify the fields we want to update!
      await backgroundDataController.saveData(url, {
        processing: {
          chat: { isGenerating: false, error: chatResult.error || 'Unknown error' }
        }
      });

      sendResponse({ 
        success: false, 
        error: chatResult.error || 'Failed to generate chat response' 
      });
    }

  } catch (error) {
    console.error('❌ Handle chat message error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // ✅ NEW: Only specify the fields we want to update!
    try {
      await backgroundDataController.saveData(url, {
        processing: {
          chat: { isGenerating: false, error: errorMessage }
        }
      });
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle clear chat history request for a specific URL
 */
export async function handleClearChatHistory(url: string, sendResponse: (response: any) => void) {
  try {
    console.log('🗑️ Clearing chat history for URL:', url);

    // Load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      sendResponse({ 
        success: false, 
        error: 'No content data found for this URL.' 
      });
      return;
    }

    // ✅ NEW: Only specify the fields we want to update!
    await backgroundDataController.saveData(url, {
      analysis: {
        chatMessages: []
      },
      processing: {
        chat: { isGenerating: false, error: null }
      }
    });

    console.log('✅ Chat history cleared successfully');
    sendResponse({ 
      success: true, 
      messages: []
    });

  } catch (error) {
    console.error('❌ Handle clear chat history error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Get chat status for a specific URL
 */
export async function getChatStatus(url: string): Promise<any> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      return { hasMessages: false, isGenerating: false, error: null };
    }

    return {
      hasMessages: (tabData.analysis?.chatMessages?.length || 0) > 0,
      messageCount: tabData.analysis?.chatMessages?.length || 0,
      isGenerating: tabData.processing?.chat?.isGenerating || false,
      error: tabData.processing?.chat?.error || null
    };
  } catch (error) {
    console.error('Failed to get chat status:', error);
    return { hasMessages: false, isGenerating: false, error: error instanceof Error ? error.message : String(error) };
  }
} 