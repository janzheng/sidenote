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
      // Optimistically append the user's message so it shows up immediately,
      // but keep a copy of the previous history to send to the background
      const trimmedMessage = message.trim();
      const previousHistory = this.state.messages;
      const optimisticUserMessage: ChatMessage = {
        role: 'user',
        content: trimmedMessage,
        timestamp: Date.now()
      };
      this.state.messages = [...previousHistory, optimisticUserMessage];
      
      const response = await chrome.runtime.sendMessage({
        action: 'sendChatMessage',
        url: url,
        message: trimmedMessage,
        chatHistory: previousHistory,
        customSystemPrompt: customSystemPrompt
      });

      if (response.success) {
        console.log('✅ Chat message sent successfully');
        this.state.messages = this.ensureTimestamps(response.messages || []);
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
        // Revert optimistic user message on failure
        this.state.messages = previousHistory;
      }
    } catch (error) {
      console.error('❌ Chat message error:', error);
      this.state.chatError = error instanceof Error ? error.message : 'Unknown error';
      // Revert optimistic user message on error
      this.state.messages = previousHistory;
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
      }
    } catch (error) {
      console.error('❌ Chat clear error:', error);
      this.state.chatError = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.state.isGenerating = false;
    }
  }

  // Ensure all messages have a timestamp, adding one if missing
  private ensureTimestamps(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(msg => msg.timestamp ? msg : { ...msg, timestamp: Date.now() });
  }

  // Set messages from external source (e.g., when loading existing chat)
  setMessages(messages: ChatMessage[]) {
    this.state.messages = this.ensureTimestamps(messages);
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