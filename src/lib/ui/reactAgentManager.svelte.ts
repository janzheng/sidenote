import { reactAgent } from '../agents/reactAgent.svelte';
import type { AgentContent } from '../agents/registry.svelte';

class ReactAgentManager {
  private state = $state({
    isRunning: false,
    error: null as string | null,
    content: [] as AgentContent[]
  });

  // Getters for reactive state
  get isRunning() {
    return this.state.isRunning || reactAgent.isRunning;
  }

  get error() {
    return this.state.error || reactAgent.error;
  }

  get content() {
    return reactAgent.content;
  }

  // Run the ReAct agent
  async handleRunAgent(
    userMessage: string,
    pageContent?: string,
    onSuccess?: () => void
  ) {
    if (this.isRunning) {
      return;
    }

    this.state.error = null;

    try {
      console.log('🤖 Starting ReAct agent with message:', userMessage);

      // Run the agent
      await reactAgent.runAgent(userMessage, pageContent);

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('❌ ReAct agent error:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset error after 5 seconds
      setTimeout(() => {
        this.state.error = null;
      }, 5000);
    }
  }

  // Stop the current agent run
  handleStopAgent() {
    reactAgent.stop();
  }

  // Clear the agent content (preserves conversation history)
  handleClearAgent(onSuccess?: () => void) {
    if (this.isRunning) {
      return;
    }

    try {
      reactAgent.clear();
      this.state.error = null;
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 100);
      }
    } catch (error) {
      console.error('❌ ReAct agent clear error:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Clear everything including conversation history
  handleClearAll(onSuccess?: () => void) {
    if (this.isRunning) {
      return;
    }

    try {
      reactAgent.clearAll();
      this.state.error = null;
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 100);
      }
    } catch (error) {
      console.error('❌ ReAct agent clear all error:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Reset manager state
  reset() {
    this.state.error = null;
    reactAgent.clearAll();
  }

  // Get content summary for context
  getContentSummary(): string {
    const content = this.content;
    if (content.length === 0) {
      return 'No agent activity';
    }

    const textItems = content.filter(item => item.type === 'text').length;
    const componentItems = content.filter(item => item.type === 'component').length;
    const thinkingItems = content.filter(item => item.type === 'thinking').length;
    
    return `${content.length} items: ${textItems} text, ${componentItems} components, ${thinkingItems} thoughts`;
  }

  // Get the last user message (if any)
  getLastUserMessage(): string | null {
    const textItems = this.content.filter(item => 
      item.type === 'text' && 'content' in item && item.content.startsWith('**User:**')
    );
    
    if (textItems.length > 0) {
      const lastUserItem = textItems[textItems.length - 1];
      if (lastUserItem.type === 'text') {
        return lastUserItem.content.replace('**User:**', '').trim();
      }
    }
    
    return null;
  }

  // Check if agent has any components
  hasComponents(): boolean {
    return this.content.some(item => item.type === 'component');
  }

  // Get all components in the current session
  getComponents(): AgentContent[] {
    return this.content.filter(item => item.type === 'component');
  }
}

// Export singleton instance
export const reactAgentManager = new ReactAgentManager(); 