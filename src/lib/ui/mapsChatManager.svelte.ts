import { ReActAgent } from '../agents/reactAgent.svelte';
import type { AgentContent } from '../agents/registry.svelte';
import { getMapsTools } from '../agents/tools.svelte';

class MapsChatManager {
  private state = $state({
    isGenerating: false,
    chatError: null as string | null,
    // Use standard ReAct agent with Maps-specific configuration
    reactAgent: new ReActAgent(),
    // Store Maps context separately
    mapsContext: ''
  });

  // Getters for reactive state
  get isGenerating() {
    return this.state.isGenerating || this.state.reactAgent.isRunning;
  }

  get chatError() {
    return this.state.chatError || this.state.reactAgent.error;
  }

  get content() {
    return this.state.reactAgent.content;
  }

  get messages() {
    // Convert AgentContent to ChatMessage format for backward compatibility
    return this.convertContentToMessages(this.state.reactAgent.content);
  }

  // Convert AgentContent to ChatMessage format for backward compatibility
  private convertContentToMessages(content: AgentContent[]): any[] {
    const messages: any[] = [];
    
    for (const item of content) {
      if (item.type === 'text') {
        // Check if it's a user message
        if (item.content.startsWith('**User:**')) {
          messages.push({
            role: 'user',
            content: item.content.replace('**User:**', '').trim()
          });
        } else {
          messages.push({
            role: 'assistant',
            content: item.content
          });
        }
      } else if (item.type === 'thinking') {
        messages.push({
          role: 'assistant',
          content: `💭 **Thinking:** ${item.content}`,
          type: 'thinking'
        });
      } else if (item.type === 'tool_result') {
        messages.push({
          role: 'tool',
          content: JSON.stringify(item.data),
          type: 'tool_result'
        });
      } else if (item.type === 'component') {
        messages.push({
          role: 'assistant',
          content: `🧩 **Component:** ${item.name}`,
          type: 'component',
          component: item
        });
      } else if (item.type === 'comment') {
        messages.push({
          role: 'assistant',
          content: item.text,
          type: 'comment'
        });
      }
    }
    
    return messages;
  }

  // Set messages (for syncing with external state) - not needed with ReAct system
  setMessages(messages: any[]) {
    // The ReAct system manages its own state, so we don't need to sync external messages
    console.log('🗺️ Maps chat now uses ReAct system - external message syncing not needed');
  }

  // Handle sending a message with Maps ReAct assistant
  async handleSendMessage(
    url: string | null,
    message: string,
    onSuccess?: () => void,
    customSystemPrompt?: string
  ) {
    if (!url || this.isGenerating) {
      return;
    }

    this.state.isGenerating = true;
    this.state.chatError = null;

    try {
      console.log('🗺️ Starting Maps ReAct agent for:', url);
      console.log('💬 User message:', message);

      // Get Maps data for context
      const mapsContext = await this.getMapsDataContext(url);
      
      // Store Maps context
      this.state.mapsContext = mapsContext;
      
      // Create Maps-specific system prompt
      const mapsSystemPrompt = this.getMapsSystemPrompt();
      
      // Get Maps tools
      const mapsTools = getMapsTools();
      
      // Run the ReAct agent with Maps context, tools, and system prompt
      await this.state.reactAgent.runAgent(
        message,
        undefined, // pageContent
        5, // maxIterations
        mapsTools, // customTools
        mapsContext, // customContext
        mapsSystemPrompt // customSystemPrompt
      );
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('❌ Maps ReAct agent error:', error);
      this.state.chatError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset error after 5 seconds
      setTimeout(() => {
        this.state.chatError = null;
      }, 5000);
    } finally {
      this.state.isGenerating = false;
    }
  }

  // Maps-specific system prompt addition
  private getMapsSystemPrompt(): string {
    return `You are a helpful Google Maps ReAct (Reasoning and Acting) agent. You can think step by step and use Maps tools to help users with location-based queries.

🛑 **CRITICAL: Tools are expensive and slow. Only use them when absolutely necessary.**

TOOL USAGE RULES:
- **FIRST**: Try to answer from your general knowledge about locations
- **ONLY use tools when**: You need current/live Maps data, specific searches, or cannot answer from knowledge
- **DON'T use tools for**: General questions, explanations, advice, common knowledge about places
- Always think before acting
- Use the exact format: "Thought: [your reasoning]" then "Action: [tool_name]" then "Action Input: [parameters]"
- When you have enough information, provide a "Final Answer: [response]"

🗺️ **YOU ARE A GOOGLE MAPS SPECIALIST**: You help users with maps, navigation, and location-based queries.

🎯 **MAPS-SPECIFIC BEHAVIOR**:
- Always consider the current Maps context provided above - you know the user's location!
- Use the location context to provide local recommendations without needing tools
- Use Maps tools when users want to search, navigate, or control the map
- Provide location-aware recommendations and analysis
- Reference specific places, ratings, and addresses when available
- When you see coordinates like (37.4317, -122.1693), you know that's Palo Alto area

🛠️ **MAPS TOOLS PRIORITY**:
- find_places_nearby: For "find X nearby", "search for Y", "where can I get Z"
- get_directions_to: For "navigate to", "directions to", "take me to"
- explore_area: For "what's around here", "what's good in this area"
- go_home: For "take me home", "directions home"
- clear_directions: For "clear directions", "exit directions", "get out of directions mode"
- change_map_view: For "satellite view", "road view", "terrain view"
- zoom_map: For "zoom in", "zoom out"

💬 **CONVERSATIONAL RESPONSES** (no tools needed):
- Opinion questions: "what do you think about X"
- General advice: "what should I eat", "any suggestions"
- Follow-up questions about places already mentioned
- Analysis of visible search results or routes

📍 **LOCATION CONTEXT**: Use the Maps context above to understand:
- Current location coordinates
- Active search results and their ratings
- Current route information
- Map view and zoom level

FORMAT EXAMPLES:

**Direct Answer (no tools needed):**
Thought: I can see from the Maps context that the user is in Palo Alto, CA area. I can provide local brunch recommendations from my knowledge.
Final Answer: Since you're in the Palo Alto area, here are some great brunch spots I'd recommend based on your current location...

**Tool Usage (when necessary):**
Thought: I need to search for specific current information about weird brunch places in Palo Alto.
Action: find_places_nearby
Action Input: {"query": "unique quirky brunch restaurants Palo Alto"}

[Tool execution happens here]

Thought: Now I have current search results, I can provide specific recommendations.
Final Answer: Based on the current search results, here are some cool and weird brunch places in Palo Alto...

Remember: Think step by step, answer directly when possible, use tools only when necessary for current/specific data.`;
  }

  // Get Maps data for context
  private async getMapsDataContext(url: string): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getMapsDataStatus',
        url: url
      });

      if (response.success && response.mapsData) {
        const data = response.mapsData;
        console.log('🗺️ Processing Maps data:', data);
        let context = 'CURRENT GOOGLE MAPS CONTEXT:\n';
        
        // Add location context if available
        if (data.currentLocation) {
          const lat = data.currentLocation.lat;
          const lng = data.currentLocation.lng;
          
          // Convert coordinates to human-readable location
          let locationName = 'Unknown Location';
          if (lat >= 37.4 && lat <= 37.5 && lng >= -122.2 && lng <= -122.1) {
            locationName = 'Palo Alto, CA area';
          } else if (lat >= 37.7 && lat <= 37.8 && lng >= -122.5 && lng <= -122.4) {
            locationName = 'San Francisco, CA area';
          } else if (lat >= 37.3 && lat <= 37.4 && lng >= -122.1 && lng <= -121.9) {
            locationName = 'San Jose, CA area';
          } else if (lat >= 37.5 && lat <= 37.6 && lng >= -122.4 && lng <= -122.3) {
            locationName = 'San Mateo, CA area';
          } else if (lat >= 37.6 && lat <= 37.7 && lng >= -122.3 && lng <= -122.2) {
            locationName = 'Redwood City, CA area';
          } else if (lat >= 37.4 && lat <= 37.5 && lng >= -122.3 && lng <= -122.2) {
            locationName = 'Mountain View, CA area';
          } else if (lat >= 37.3 && lat <= 37.4 && lng >= -122.0 && lng <= -121.9) {
            locationName = 'Sunnyvale, CA area';
          } else if (lat >= 37.5 && lat <= 37.6 && lng >= -122.2 && lng <= -122.1) {
            locationName = 'Menlo Park, CA area';
          }
          
          context += `📍 Current Location: ${locationName} (${lat.toFixed(4)}, ${lng.toFixed(4)})\n`;
        }
        
        if (data.searchQuery) {
          context += `🔍 Current Search: "${data.searchQuery}"\n`;
        }
        
        if (data.searchResults?.length > 0) {
          context += `📋 Search Results (${data.searchResults.length} places found):\n`;
          data.searchResults.slice(0, 5).forEach((result: any, index: number) => {
            context += `  ${index + 1}. ${result.name}`;
            if (result.rating) context += ` (${result.rating}⭐)`;
            if (result.address) context += ` - ${result.address}`;
            context += '\n';
          });
          if (data.searchResults.length > 5) {
            context += `  ... and ${data.searchResults.length - 5} more results\n`;
          }
        }
        
        if (data.currentRoute) {
          context += `🚗 Active Route: ${data.currentRoute.origin.address} → ${data.currentRoute.destination.address}\n`;
          context += `   Distance: ${data.currentRoute.distance}, Duration: ${data.currentRoute.duration}\n`;
        }
        
        if (data.mapType) {
          context += `🗺️ Map View: ${data.mapType}\n`;
        }
        
        if (data.zoomLevel) {
          context += `🔍 Zoom Level: ${data.zoomLevel}\n`;
        }
        
        context += `\n⏰ Data extracted at: ${new Date(data.extractedAt).toLocaleString()}\n`;
        
        return context;
      }
      
      return 'MAPS CONTEXT: No current Google Maps data available. User may need to extract Maps data first.';
    } catch (error) {
      console.error('🗺️ Error getting Maps data:', error);
      return 'MAPS CONTEXT: Unable to fetch current Maps data.';
    }
  }

  // Handle clearing chat
  async handleClearChat(url: string | null, onSuccess?: () => void) {
    if (!url || this.isGenerating) {
      return;
    }

    try {
      console.log('🗺️ Clearing Maps ReAct agent for:', url);
      
      // Clear the ReAct store content but preserve conversation history
      this.state.reactAgent.clear();
      this.state.chatError = null;
      
      // Call success callback
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 100);
      }
    } catch (error) {
      console.error('❌ Maps chat clear error:', error);
      this.state.chatError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Handle clearing all (including conversation history)
  async handleClearAll(url: string | null, onSuccess?: () => void) {
    if (!url || this.isGenerating) {
      return;
    }

    try {
      console.log('🗺️ Clearing all Maps ReAct agent data for:', url);
      
      // Clear everything including conversation history
      this.state.reactAgent.clearAll();
      this.state.chatError = null;
      
      // Call success callback
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 100);
      }
    } catch (error) {
      console.error('❌ Maps chat clear all error:', error);
      this.state.chatError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Stop the current agent run
  handleStopAgent() {
    this.state.reactAgent.stop();
  }

  // Reset Maps chat manager state
  reset() {
    this.state.isGenerating = false;
    this.state.chatError = null;
    this.state.reactAgent.clearAll();
  }

  // Get conversation summary for context
  getConversationSummary(): string {
    const content = this.state.reactAgent.content;
    if (content.length === 0) {
      return 'No Maps conversation yet';
    }

    const textItems = content.filter((item: AgentContent) => item.type === 'text').length;
    const componentItems = content.filter((item: AgentContent) => item.type === 'component').length;
    const thinkingItems = content.filter((item: AgentContent) => item.type === 'thinking').length;
    const toolItems = content.filter((item: AgentContent) => item.type === 'tool_result').length;
    
    return `${content.length} items: ${textItems} messages, ${thinkingItems} thoughts, ${toolItems} tool results, ${componentItems} components`;
  }

  // Get the last user message
  getLastUserMessage(): string | null {
    const content = this.state.reactAgent.content;
    const userMessages = content.filter((item: AgentContent) => 
      item.type === 'text' && 'content' in item && item.content.startsWith('**User:**')
    );
    
    if (userMessages.length > 0) {
      const lastUserItem = userMessages[userMessages.length - 1];
      if (lastUserItem.type === 'text') {
        return lastUserItem.content.replace('**User:**', '').trim();
      }
    }
    
    return null;
  }

  // Get the last assistant message
  getLastAssistantMessage(): string | null {
    const content = this.state.reactAgent.content;
    const assistantMessages = content.filter((item: AgentContent) => 
      item.type === 'text' && 'content' in item && !item.content.startsWith('**User:**')
    );
    
    if (assistantMessages.length > 0) {
      const lastAssistantItem = assistantMessages[assistantMessages.length - 1];
      if (lastAssistantItem.type === 'text') {
        return lastAssistantItem.content;
      }
    }
    
    return null;
  }

  // Check if agent has any components
  hasComponents(): boolean {
    return this.state.reactAgent.content.some((item: AgentContent) => item.type === 'component');
  }

  // Get all components in the current session
  getComponents(): AgentContent[] {
    return this.state.reactAgent.content.filter((item: AgentContent) => item.type === 'component');
  }

  // Get rich content for display (main interface for UI)
  get richContent(): AgentContent[] {
    return this.state.reactAgent.content;
  }
}

// Export singleton instance
export const mapsChatManager = new MapsChatManager(); 