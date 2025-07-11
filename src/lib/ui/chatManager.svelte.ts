import type { ChatMessage } from '../../types/chatMessage';

export interface ChatState {
  isGenerating: boolean;
  chatError: string | null;
  messages: ChatMessage[];
}

class ChatManager {
  private state = $state<ChatState>({
    isGenerating: false,
    chatError: null,
    messages: []
  });

  // Getters for reactive state
  get isGenerating() {
    return this.state.isGenerating;
  }

  get chatError() {
    return this.state.chatError;
  }

  get messages() {
    return this.state.messages;
  }

  get hasMessages() {
    return this.state.messages.length > 0;
  }

  // Send chat message functionality
  async handleSendMessage(url: string | null, message: string, onSuccess?: () => void, customSystemPrompt?: string) {
    if (!url || !message.trim() || this.state.isGenerating) {
      return;
    }

    this.state.isGenerating = true;
    this.state.chatError = null;

    try {
      console.log('💬 Sending chat message for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'sendChatMessage',
        url: url,
        message: message.trim(),
        chatHistory: this.state.messages,
        customSystemPrompt: customSystemPrompt
      });

      if (response.success) {
        console.log('✅ Chat message sent successfully');
        this.state.messages = response.messages || [];
        this.state.chatError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
      } else {
        console.error('❌ Chat message failed:', response.error);
        this.state.chatError = response.error;
        
        // Reset error after 5 seconds
        setTimeout(() => {
          this.state.chatError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Chat message error:', error);
      this.state.chatError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset error after 5 seconds
      setTimeout(() => {
        this.state.chatError = null;
      }, 5000);
    } finally {
      this.state.isGenerating = false;
    }
  }

  // Clear chat history
  async handleClearChat(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isGenerating) {
      return;
    }

    this.state.isGenerating = true;
    this.state.chatError = null;

    try {
      console.log('🗑️ Clearing chat for:', url);
      
      const response = await chrome.runtime.sendMessage({
        action: 'clearChatHistory',
        url: url
      });

      if (response.success) {
        console.log('✅ Chat cleared successfully');
        this.state.messages = [];
        this.state.chatError = null;
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100);
        }
      } else {
        console.error('❌ Chat clear failed:', response.error);
        this.state.chatError = response.error;
        
        // Reset error after 5 seconds
        setTimeout(() => {
          this.state.chatError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Chat clear error:', error);
      this.state.chatError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset error after 5 seconds
      setTimeout(() => {
        this.state.chatError = null;
      }, 5000);
    } finally {
      this.state.isGenerating = false;
    }
  }

  // Set messages from external source (e.g., when loading existing chat)
  setMessages(messages: ChatMessage[]) {
    this.state.messages = messages;
  }

  // Reset chat state
  reset() {
    this.state.isGenerating = false;
    this.state.chatError = null;
    this.state.messages = [];
  }
}

// Export singleton instance
export const chatManager = new ChatManager(); 