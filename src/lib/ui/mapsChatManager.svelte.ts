import { ReActAgent } from '../agents/reactAgent.svelte';
import type { AgentContent } from '../agents/registry.svelte';
import { getMapsTools, getAgentTools } from '../agents/tools.svelte';
import type { TravelMode, RouteOption } from '../../types/mapsData';

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

      // First, try to extract Maps data if we don't have any recent data
      const currentMapsContext = await this.getMapsDataContext(url);
      if (currentMapsContext.includes('No current Google Maps data available')) {
        console.log('🔄 No Maps data available, extracting first...');
        
        // Extract Maps data before proceeding
        await chrome.runtime.sendMessage({
          action: 'extractMapsData',
          url: url
        });
        
        // Wait for extraction to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Get Maps data for context (refresh after potential extraction)
      const mapsContext = await this.getMapsDataContext(url);
      
      // Store Maps context
      this.state.mapsContext = mapsContext;
      
      // Create Maps-specific system prompt
      const mapsSystemPrompt = this.getMapsSystemPrompt();
      
      // Get Maps tools and web search tools
      const mapsTools = getMapsTools();
      const allTools = getAgentTools(); // This includes web search
      
      // Combine Maps tools with web search for comprehensive capabilities
      const combinedTools = [...mapsTools, ...allTools.filter(tool => 
        !mapsTools.some(mapsTool => mapsTool.name === tool.name)
      )];
      
      // Run the ReAct agent with Maps context, tools, and system prompt
      await this.state.reactAgent.runAgent(
        message,
        undefined, // pageContent
        25, // maxIterations - increased for complex searches
        combinedTools, // customTools - now includes both Maps and web search
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
    // Include the current Maps context in the system prompt
    const contextToInclude = this.state.mapsContext || 'No Maps context available yet.';
    
    return `You are a helpful Google Maps ReAct (Reasoning and Acting) agent. You can think step by step and use Maps tools to help users with location-based queries.

${contextToInclude}

🛑 **CRITICAL: Tools are expensive and slow. Only use them when absolutely necessary.**

TOOL USAGE RULES:
- **FIRST**: Try to answer from your general knowledge about locations
- **ONLY use tools when**: You need current/live Maps data, specific searches, or cannot answer from knowledge
- **DON'T use tools for**: General questions, explanations, advice, common knowledge about places
- Always think before acting
- Use the exact format: "Thought: [your reasoning]" then "Action: [tool_name]" then "Action Input: [parameters]"
- **IMPORTANT**: For multi-destination trips, use simple arrays: {"destinations": ["Mystery Spot", "Shadowbrook Restaurant"]} or comma-separated strings: {"destinations": "Mystery Spot, Shadowbrook Restaurant"}
- When you have enough information, provide a "Final Answer: [response]"

🗺️ **YOU ARE A GOOGLE MAPS SPECIALIST**: You help users with maps, navigation, and location-based queries.

🎯 **MAPS-SPECIFIC BEHAVIOR**:
- Always consider the current Maps context provided above - you know the user's location!
- **CONVERT COORDINATES TO LOCATION NAMES**: When you see coordinates like (37.4317, -122.1693), convert them to human-readable location names using your geographic knowledge (e.g., "Palo Alto, CA area", "San Francisco, CA area", etc.)
- **MANDATORY: ALWAYS ADD COUNTRY TO DESTINATIONS**: Every destination must include ", [Country]" - no exceptions:
  - "Christchurch, New Zealand" not "Christchurch"
  - "Brew Moon Brewing Company, New Zealand" not "Brew Moon Brewing Company"
  - "Mount Hutt, New Zealand" not "Mount Hutt"
  - This prevents Google Maps confusion and ensures accurate routing
- Use the location context to provide local recommendations without needing tools
- Use Maps tools when users want to search, navigate, or control the map
- Provide location-aware recommendations and analysis
- Reference specific places, ratings, and addresses when available

🛠️ **TOOL SELECTION PRIORITY**:

**WEB SEARCH TOOLS** (for research and detailed information):
- web_search: For "best pizza", "top rated restaurants", "reviews of X", "what do people say about Y"
  Use when you need detailed reviews, ratings, comparisons, or comprehensive information

**MAPS TOOLS** (for navigation and map control):
- find_places_nearby: For "find X nearby", "search for Y", "where can I get Z" (when you want to show results on map)
- get_directions_to: For "navigate to", "directions to", "take me to" (supports single destination or multi-destination with waypoints)
- plan_multi_destination_trip: For "plan a trip to A, B, and C", "visit multiple places", "multi-stop journey" (creates optimized multi-destination routes)
  **PARAMETER FORMAT**: Use simple arrays like {"destinations": ["Place1", "Place2", "Place3"]} - DO NOT use complex JSON with nested objects
  **LOCATION FORMAT**: ALWAYS include country in every destination: ["Christchurch, New Zealand", "Queenstown, New Zealand"] - NO parentheses
- validate_multi_destination_route: **USE AFTER CREATING ROUTES** to check for geographic inconsistencies (e.g., brewery in NY instead of NZ)
  **WHEN TO USE**: After plan_multi_destination_trip, especially for international routes or when ambiguous place names might exist
  **AUTO-FIX**: Automatically corrects problematic locations and recreates the route with proper names
- update_multi_destination_trip: For "add X to the route", "remove Y from trip", "change the itinerary", "revise the route" (updates existing multi-destination routes)
- add_waypoint: For "add a stop at", "stop by", "add waypoint" (adds intermediate stops to existing route)
- explore_area: For "what's around here", "what's good in this area"
- go_home: For "take me home", "directions home"
- clear_directions: For "clear directions", "exit directions", "get out of directions mode"
- change_map_view: For "satellite view", "road view", "terrain view"
- zoom_map: For "zoom in", "zoom out"

🚗 **MULTI-DESTINATION TRIP PLANNING**:
- **PROACTIVELY SUGGEST MULTI-DESTINATION TRIPS** when users are flexible or want suggestions:
  - "I want to explore the area" → Suggest a multi-stop journey with 3-4 interesting places
  - "What should I do today?" → Research best local attractions and create a multi-destination route
  - "I'm looking for good food" → Find 2-3 highly-rated restaurants and plan a food tour
  - "Show me the highlights" → Create a curated multi-stop tour of top attractions
  - "I have time to kill" → Suggest an efficient multi-destination route based on their interests
  - "What's worth visiting?" → Research and plan a multi-destination trip to the best local spots

- **LOCATION CONTEXT OVERRIDE**:
  - If use mentions "Use my location" then Start from current location and End at current location
  - **IGNORE CURRENT LOCATION** when user specifies a different geographic area WITHOUT mentioning starting from current location:
    - "plan a trip around [city/region/country]" → Use the specified location, NOT current location
    - "epic trip around [geographic area]" → Focus on the specified area, NOT current location
    - "multi-destination trip in [location]" → Plan for the specified location, NOT current location
  - **RESPECT CURRENT LOCATION** when user explicitly mentions it:
    - "starting from my location" → Always use current location as origin
    - "ending at my location" → Always use current location in the route
    - "from here to [destination]" → Use current location as starting point
  - **USE SPECIFIC LOCATION NAMES**: For international trips, always include country/region:
    - "[City] Airport, [Country]" instead of just "[City]"
    - "[City], [Country]" instead of just "[City]"
    - This helps Google Maps resolve ambiguous location names correctly
  - **MANDATORY LOCATION FORMAT**: Always append ", [Country]" to every destination (no parentheses):
    - "Christchurch, New Zealand" not "Christchurch"
    - "Brew Moon Brewing Company, New Zealand" not "Brew Moon Brewing Company"
    - "Mount Hutt, New Zealand" not "Mount Hutt"
    - "Lake Tekapo, New Zealand" not "Lake Tekapo"
  - **INDICATORS TO OVERRIDE CURRENT LOCATION**:
    - Geographic names different from current location (e.g., "South Island", "Tokyo", "Europe")
    - Airport codes or airport names as starting points
    - Phrases like "around", "in", "through", "across" followed by location names
    - Travel-specific language like "starting and ending at", "epic trip", "tour of"

- **DECISION FRAMEWORK FOR TRIP PLANNING**:
  1. If user mentions multiple interests/activities → plan_multi_destination_trip
  2. If user is flexible/wants suggestions → web_search for research, then plan_multi_destination_trip
  3. If user asks for "the best" of something → web_search + plan_multi_destination_trip
  4. If user wants to "explore" or "see what's around" → plan_multi_destination_trip with local highlights
  5. **If user specifies a different geographic area WITHOUT mentioning current location → IGNORE current location and focus on specified area**
  6. **If user explicitly mentions "my location", "from here", "starting from my location" → ALWAYS respect and use current location**
  7. **AFTER creating international routes → ALWAYS use validate_multi_destination_route to check for geographic errors**

**DECISION RULES**:
- Use web_search when user wants research, reviews, "best of" lists, comparisons, or detailed information
- Use Maps tools when user wants to navigate, see locations on map, or control the map interface
- For queries like "best pizza in area", use web_search first to get comprehensive reviews and ratings
- **For flexible/exploratory queries, combine web_search research with plan_multi_destination_trip to create curated experiences**

💬 **CONVERSATIONAL RESPONSES** (no tools needed):
- Opinion questions: "what do you think about X"
- General advice: "what should I eat", "any suggestions"
- Follow-up questions about places already mentioned
- Analysis of visible search results or routes
- Questions about current search results: "which one of these are good", "what do you recommend", "which should I choose"

🚨 **CRITICAL USER INTERACTION RULE**:
- **NEVER assume user consent**: If you ask "Would you like me to..." or "Should I..." or "Do you want..." - ALWAYS wait for the user's explicit response
- **STOP after asking questions**: When you ask the user a question, provide a "Final Answer" and wait for their reply
- **Don't auto-execute**: Never automatically execute tools after asking permission questions

📍 **LOCATION CONTEXT**: Use the Maps context above to understand:
- Current location coordinates
- Active search results and their ratings
- Current route information
- Map view and zoom level

FORMAT EXAMPLES:

**Direct Answer (no tools needed):**
Thought: I can see from the Maps context that the user is in Palo Alto, CA area. I can provide local brunch recommendations from my knowledge.
Final Answer: Since you're in the Palo Alto area, here are some great brunch spots I'd recommend based on your current location...

**Analysis of Current Search Results:**
Thought: The user is asking "which one of these are good" and I can see search results in the Maps context. I should analyze the visible results and provide recommendations based on ratings, reviews, and location.
Final Answer: Looking at your current search results, I'd recommend [specific place name] because it has [rating/reasons]. [Another place] is also excellent for [specific reasons]. Here's my analysis of each option...

**Web Search for Research:**
Thought: The user wants to know about the BEST pizza places, which requires research on reviews and ratings.
Action: web_search
Action Input: {"query": "best pizza restaurants Palo Alto reviews ratings"}

[Tool execution happens here]

Thought: Now I have comprehensive information about top-rated pizza places with reviews and ratings.
Final Answer: Based on current reviews and ratings, here are the best pizza places in Palo Alto...

**Maps Tool for Navigation:**
Thought: The user wants to see pizza places on the map and navigate to one.
Action: find_places_nearby
Action Input: {"query": "pizza restaurants"}

[Tool execution happens here]

Thought: Now I can see the pizza places on the map. I should ask the user which one they want directions to and wait for their response.
Final Answer: I've found pizza places on the map. Would you like directions to any of these locations? Just let me know which one interests you!

**User Response to Question:**
User: "Yes, can you get directions to Blue Ocean Brewing?"
Thought: The user has explicitly requested directions to Blue Ocean Brewing. Now I can execute the directions tool.
Action: get_directions_to
Action Input: {"destination": "Blue Ocean Brewing"}

[Tool execution happens here]

Thought: I've successfully opened directions to Blue Ocean Brewing.
Final Answer: Perfect! I've opened directions to Blue Ocean Brewing. You can now see the turn-by-turn navigation on Google Maps.

**Multi-Destination Trip Planning (Flexible/Exploratory):**
User: "I want to explore the area and see what's good"
Thought: The user is flexible and wants suggestions for exploring. I should research the best local attractions and create a multi-destination trip. First, I'll search for top-rated places in their area.
Action: web_search
Action Input: {"query": "best attractions restaurants things to do Palo Alto area top rated"}

[Tool execution happens here]

Thought: Now I have information about the best local spots. I should create a multi-destination trip with 3-4 interesting places that would make for a good exploration route.
Action: plan_multi_destination_trip
Action Input: {"destinations": "Stanford University Campus, Philz Coffee, Gamble Garden, Whole Foods Market"}

[Tool execution happens here]

Thought: I've created a multi-destination route that combines popular attractions, good food, and interesting stops for exploration.
Final Answer: I've created a great exploration route for you! This multi-destination trip includes Stanford University Campus (beautiful architecture and grounds), Philz Coffee (local favorite), Gamble Garden (peaceful botanical garden), and Whole Foods Market (great for local treats). The route is optimized for efficient travel between stops. You can reorder or modify any stops as you explore!

**Multi-Destination Trip Planning (Different Geographic Area):**
User: "help me plan an epic multi-destination trip around [region/country], starting and ending at an airport w/ good food, drinks, and activities"
Thought: The user wants to plan a trip around a specific region/country, starting and ending at an airport. This is NOT about their current location - they specifically mentioned the geographic area and "starting and ending at an airport". I should IGNORE their current location and focus on the specified region. I need to research the best spots for their interests in that area.
Action: web_search
Action Input: {"query": "[region/country] best food drinks activities airports"}

[Tool execution happens here]

Thought: Now I have information about the region's best spots. I should create a multi-destination trip that starts and ends at an airport and includes locations that match their interests.
Action: plan_multi_destination_trip
Action Input: {"destinations": "[Airport], [City1], [City2], [City3], [Airport]", "from": "[Airport]"}

[Tool execution happens here]

Thought: I've created a comprehensive trip that covers diverse experiences in the specified region. Now I should validate the route to ensure all locations are correctly placed geographically, especially since some place names might be ambiguous.
Action: validate_multi_destination_route
Action Input: {"destinations": "[Airport], [City1], [City2], [City3], [Airport]", "expected_region": "[Country]"}

[Tool execution happens here]

Thought: The validation passed/found issues and corrected them. Now I can provide the final answer.
Final Answer: I've planned an epic adventure for you! This multi-destination trip starts and ends at [Airport] and includes: [City1] ([activity/attraction]), [City2] ([activity/attraction]), and [City3] ([activity/attraction]). I've also validated the route to ensure all locations are correctly placed in [region/country], so Google Maps should work perfectly! This route gives you the perfect mix of [user's interests] across [region/country]!

Remember: Think step by step, answer directly when possible, use tools only when necessary for current/specific data. Always wait for user confirmation when asking permission questions. **Proactively suggest multi-destination trips when users are flexible or want to explore!**`;
  }

  // Get Maps data for context
  private async getMapsDataContext(url: string): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getMapsDataStatus',
        url: url
      });

      if (response.success && response.status && response.status.mapsData) {
        const data = response.status.mapsData;
        console.log('🗺️ Processing Maps data:', data);
        let context = 'CURRENT GOOGLE MAPS CONTEXT:\n';
        
        // Add location context if available
        if (data.currentLocation) {
          const lat = data.currentLocation.lat;
          const lng = data.currentLocation.lng;
          
          context += `📍 Current Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}\n`;
        }
        
        if (data.searchQuery) {
          context += `🔍 Current Search: "${data.searchQuery}"\n`;
        }
        
        if (data.searchResults?.length > 0) {
          context += `📋 Search Results (${data.searchResults.length} places found):\n`;
          data.searchResults.forEach((result: any, index: number) => {
            context += `  ${index + 1}. **${result.name}**`;
            if (result.rating) context += ` (${result.rating}⭐)`;
            if (result.priceLevel) context += ` - ${'$'.repeat(result.priceLevel)}`;
            if (result.address) context += ` - ${result.address}`;
            if (result.types && result.types.length > 0) context += ` - ${result.types.join(', ')}`;
            if (result.phoneNumber) context += ` - ${result.phoneNumber}`;
            if (result.openingHours && result.openingHours.length > 0) context += ` - ${result.openingHours[0]}`;
            context += '\n';
          });
        }
        
        if (data.currentRoute) {
          context += `🚗 Active Route: ${data.currentRoute.origin.address} → ${data.currentRoute.destination.address}\n`;
          context += `   Distance: ${data.currentRoute.distance}, Duration: ${data.currentRoute.duration}\n`;
          
          if (data.currentRoute.selectedTravelMode) {
            context += `   Travel Mode: ${data.currentRoute.selectedTravelMode}\n`;
          }
          
          if (data.currentRoute.travelModes && data.currentRoute.travelModes.length > 0) {
            context += `   Available Modes: `;
            const modeList = (data.currentRoute.travelModes as TravelMode[]).map((mode: TravelMode) => 
              `${mode.mode} (${mode.duration})${mode.isSelected ? ' ✅' : ''}`
            ).join(', ');
            context += modeList + '\n';
          }
          
          if (data.currentRoute.waypoints && data.currentRoute.waypoints.length > 0) {
            context += `   Waypoints: `;
            const waypointList = data.currentRoute.waypoints.map((waypoint: any, index: number) => 
              `${index + 1}. ${waypoint.address}`
            ).join(', ');
            context += waypointList + '\n';
          }
          
          if (data.currentRoute.routeOptions && data.currentRoute.routeOptions.length > 1) {
            context += `   Route Options: `;
            const optionList = (data.currentRoute.routeOptions as RouteOption[]).map((option: RouteOption, index: number) => 
              `${index + 1}. ${option.duration} (${option.distance})${option.description ? ` - ${option.description}` : ''}`
            ).join(', ');
            context += optionList + '\n';
          }
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