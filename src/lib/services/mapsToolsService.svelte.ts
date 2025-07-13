import type { Tool } from './groqService.svelte';
import type { ToolCall } from '../../types/chatMessage';
import type { MapsControlCommand } from '../../types/mapsData';
import { mapsManager } from '../ui/mapsManager.svelte';

/**
 * Maps Tools Service - Defines tools for Google Maps operations
 * These tools can be used by Groq's tool calling functionality
 */
export class MapsToolsService {
  
  /**
   * Get all available Maps tools
   */
  static getTools(): Tool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'search_maps',
          description: 'Search for places, businesses, or locations on Google Maps. Use this for queries like "find restaurants", "search for gas stations", "look for coffee shops near me".',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search term or query to look for on Google Maps (e.g., "pizza restaurants", "gas stations", "Central Park")'
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_directions',
          description: 'Get directions to a specific destination on Google Maps. Use this for navigation requests like "directions to airport", "navigate to Times Square", "route to 123 Main St".',
          parameters: {
            type: 'object',
            properties: {
              destination: {
                type: 'string',
                description: 'The destination address or place name to navigate to'
              },
              origin: {
                type: 'string',
                description: 'Optional starting point. If not provided, will use current location or "My Location"'
              }
            },
            required: ['destination']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'zoom_map',
          description: 'Zoom in or out on the Google Maps view. Use this for requests like "zoom in", "zoom out", "zoom closer", "zoom further".',
          parameters: {
            type: 'object',
            properties: {
              direction: {
                type: 'string',
                description: 'Direction to zoom: "in" to zoom closer, "out" to zoom further away',
                enum: ['in', 'out']
              }
            },
            required: ['direction']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'change_map_view',
          description: 'Change the Google Maps view type (satellite, road, terrain, etc.). Use this for requests like "switch to satellite view", "show terrain", "road view".',
          parameters: {
            type: 'object',
            properties: {
              mapType: {
                type: 'string',
                description: 'The map view type to switch to',
                enum: ['roadmap', 'satellite', 'hybrid', 'terrain']
              }
            },
            required: ['mapType']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pan_to_location',
          description: 'Pan the map to show a specific location by coordinates. Use this when you have specific latitude and longitude coordinates.',
          parameters: {
            type: 'object',
            properties: {
              latitude: {
                type: 'number',
                description: 'Latitude coordinate (e.g., 40.7128 for New York City)'
              },
              longitude: {
                type: 'number',
                description: 'Longitude coordinate (e.g., -74.0060 for New York City)'
              }
            },
            required: ['latitude', 'longitude']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'extract_maps_data',
          description: 'Extract current data from the Google Maps page including location, search results, routes, and map settings. Use this to get information about what\'s currently displayed on the map.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'analyze_current_results',
          description: 'Analyze the current search results or map data to provide recommendations and insights. Use this after searching to understand what options are available and provide specific recommendations.',
          parameters: {
            type: 'object',
            properties: {
              focus: {
                type: 'string',
                description: 'What to focus the analysis on: "restaurants", "ratings", "distance", "variety", or "recommendations"'
              }
            },
            required: []
          }
        }
      }
    ];
  }

  /**
   * Execute a tool call and return the result
   */
  static async executeToolCall(toolCall: ToolCall, url: string | null, onRefresh?: () => void): Promise<string> {
    try {
      console.log(`🛠️ Executing Maps tool: ${toolCall.function.name}`);
      
      if (!url) {
        return 'Error: No URL provided for Maps operation';
      }

      // Parse the tool arguments
      let args: any;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        return `Error: Invalid tool arguments - ${error instanceof Error ? error.message : 'Unknown error'}`;
      }

      // Execute the appropriate tool
      switch (toolCall.function.name) {
        case 'search_maps':
          return await this.executeSearch(url, args.query, onRefresh);
        
        case 'get_directions':
          return await this.executeDirections(url, args.destination, args.origin, onRefresh);
        
        case 'zoom_map':
          return await this.executeZoom(url, args.direction, onRefresh);
        
        case 'change_map_view':
          return await this.executeMapTypeChange(url, args.mapType, onRefresh);
        
        case 'pan_to_location':
          return await this.executePanTo(url, args.latitude, args.longitude, onRefresh);
        
        case 'extract_maps_data':
          return await this.executeDataExtraction(url, onRefresh);
        
        case 'analyze_current_results':
          return await this.executeResultAnalysis(url, args.focus, onRefresh);
        
        default:
          return `Error: Unknown tool function: ${toolCall.function.name}`;
      }

    } catch (error) {
      console.error(`❌ Tool execution failed for ${toolCall.function.name}:`, error);
      return `Error executing ${toolCall.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Execute search tool with enhanced response and automatic data analysis
   */
  private static async executeSearch(url: string, query: string, onRefresh?: () => void): Promise<string> {
    try {
      console.log(`🔍 Searching for: "${query}"`);
      
      // Execute the search command and wait for it to complete
      await mapsManager.search(url, query, () => {
        console.log(`✅ Search command executed for: "${query}"`);
        if (onRefresh) onRefresh();
      });
      
      // Wait for results to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        console.log(`📊 Extracting data after search to analyze results`);
        
        // Extract the current Maps data to get search results
        await mapsManager.handleExtractMapsData(url, () => {
          console.log(`✅ Data extraction after search completed`);
        });
        
        // Wait for extraction to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
                // Now get the actual Maps data and analyze it
        const mapsDataResponse = await chrome.runtime.sendMessage({
          action: 'getMapsDataStatus',
          url: url
        });
        
        if (mapsDataResponse.success && mapsDataResponse.status && mapsDataResponse.status.mapsData) {
          const mapsData = mapsDataResponse.status.mapsData;
          console.log('📊 Analyzing extracted Maps data:', mapsData);
          
          let analysis = `Successfully searched for "${query}" on Google Maps! `;
          
          // Analyze search results if available
          if (mapsData.searchResults && mapsData.searchResults.length > 0) {
            const results = mapsData.searchResults;
            const topResults = results; // Show all results instead of limiting to 5
            
            analysis += `I found ${results.length} places. Here are the options:\n\n`;
            
            topResults.forEach((place: any, index: number) => {
              analysis += `**${index + 1}. ${place.name}**\n`;
              if (place.rating) {
                analysis += `⭐ ${place.rating} stars`;
                if (place.reviewCount) {
                  analysis += ` (${place.reviewCount} reviews)`;
                }
                analysis += '\n';
              }
              if (place.address) {
                analysis += `📍 ${place.address}\n`;
              }
              if (place.priceLevel) {
                const priceSymbols = '$'.repeat(place.priceLevel);
                analysis += `💰 ${priceSymbols}\n`;
              }
              if (place.businessStatus) {
                analysis += `🕒 ${place.businessStatus}\n`;
              }
              analysis += '\n';
            });
            
            // Add recommendations based on ratings
            const highRated = topResults.filter((p: any) => p.rating && p.rating >= 4.0);
            if (highRated.length > 0) {
              const best = highRated[0];
              analysis += `🏆 **Top Recommendation**: ${best.name}`;
              if (best.rating) {
                analysis += ` (${best.rating}⭐)`;
              }
              analysis += ` stands out for its excellent ratings`;
              if (best.reviewCount && best.reviewCount > 50) {
                analysis += ` and strong review count`;
              }
              analysis += '.\n\n';
            }
            
            analysis += `Would you like directions to any of these places, or would you like me to search for something more specific?`;
            
          } else {
            analysis += `The search was executed on Google Maps and the results are now displayed. You can see the search results on the map interface.`;
          }
          
          console.log(`✅ Search and analysis completed for: "${query}"`);
          return analysis;
        } else {
          // Fallback if data extraction fails
          const response = `Successfully searched for "${query}" on Google Maps. The search results are now displayed on the map for you to explore.`;
          
          console.log(`✅ Search completed for: "${query}" (fallback response)`);
          return response;
        }
      } catch (extractError) {
        console.warn(`⚠️ Could not extract data after search:`, extractError);
        const response = `Successfully searched for "${query}" on Google Maps. The search results are now displayed on the map.`;
        return response;
      }
    } catch (error) {
      const errorMsg = `Failed to search for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ Search failed:`, errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Execute directions tool with enhanced response
   */
  private static async executeDirections(url: string, destination: string, origin?: string, onRefresh?: () => void): Promise<string> {
    return new Promise((resolve) => {
      console.log(`🧭 Getting directions to: "${destination}"${origin ? ` from: "${origin}"` : ''}`);
      
      mapsManager.getDirections(url, destination, origin, () => {
        if (onRefresh) onRefresh();
        
        const originText = origin ? ` from "${origin}"` : ' from your current location';
        const response = `Successfully opened directions to "${destination}"${originText}. The route is now displayed on Google Maps with turn-by-turn navigation instructions, estimated travel time, and distance information.`;
        
        console.log(`✅ Directions opened for: "${destination}"`);
        resolve(response);
      }).catch((error) => {
        const errorMsg = `Failed to get directions to "${destination}": ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ Directions failed:`, errorMsg);
        resolve(errorMsg);
      });
    });
  }

  /**
   * Execute zoom tool with enhanced response
   */
  private static async executeZoom(url: string, direction: 'in' | 'out', onRefresh?: () => void): Promise<string> {
    return new Promise((resolve) => {
      console.log(`🔍 Zooming ${direction}`);
      
      const zoomFunction = direction === 'in' ? mapsManager.zoomIn : mapsManager.zoomOut;
      zoomFunction.call(mapsManager, url, () => {
        if (onRefresh) onRefresh();
        
        const response = direction === 'in' 
          ? `Successfully zoomed in on Google Maps. You now have a closer, more detailed view of the area with more specific landmarks and street details visible.`
          : `Successfully zoomed out on Google Maps. You now have a wider view of the area, showing more of the surrounding region and broader geographic context.`;
        
        console.log(`✅ Zoom ${direction} completed`);
        resolve(response);
      }).catch((error) => {
        const errorMsg = `Failed to zoom ${direction}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ Zoom failed:`, errorMsg);
        resolve(errorMsg);
      });
    });
  }

  /**
   * Execute map type change tool with enhanced response
   */
  private static async executeMapTypeChange(url: string, mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain', onRefresh?: () => void): Promise<string> {
    return new Promise((resolve) => {
      console.log(`🗺️ Changing map view to: ${mapType}`);
      
      mapsManager.changeMapType(url, mapType, () => {
        if (onRefresh) onRefresh();
        
        const viewDescriptions = {
          roadmap: 'standard road map view with streets, labels, and points of interest clearly marked',
          satellite: 'satellite imagery view showing aerial photos of the actual terrain and buildings',
          hybrid: 'hybrid view combining satellite imagery with road labels and street names overlay',
          terrain: 'terrain view highlighting topographical features, elevation changes, and natural landmarks'
        };
        
        const response = `Successfully changed the map view to ${mapType} mode. You're now viewing the area in ${viewDescriptions[mapType]}. This view is great for ${this.getViewBenefits(mapType)}.`;
        
        console.log(`✅ Map view changed to: ${mapType}`);
        resolve(response);
      }).catch((error) => {
        const errorMsg = `Failed to change map view to ${mapType}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ Map view change failed:`, errorMsg);
        resolve(errorMsg);
      });
    });
  }

  /**
   * Execute pan to location tool with enhanced response
   */
  private static async executePanTo(url: string, latitude: number, longitude: number, onRefresh?: () => void): Promise<string> {
    return new Promise((resolve) => {
      console.log(`📍 Panning to coordinates: ${latitude}, ${longitude}`);
      
      mapsManager.panTo(url, { lat: latitude, lng: longitude }, () => {
        if (onRefresh) onRefresh();
        
        const response = `Successfully panned the map to coordinates ${latitude}, ${longitude}. The map is now centered on this specific location, showing the surrounding area and nearby landmarks.`;
        
        console.log(`✅ Panned to: ${latitude}, ${longitude}`);
        resolve(response);
      }).catch((error) => {
        const errorMsg = `Failed to pan to coordinates ${latitude}, ${longitude}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ Pan failed:`, errorMsg);
        resolve(errorMsg);
      });
    });
  }

  /**
   * Execute data extraction tool with enhanced response
   */
  private static async executeDataExtraction(url: string, onRefresh?: () => void): Promise<string> {
    return new Promise((resolve) => {
      console.log(`📊 Extracting current Maps data`);
      
      mapsManager.handleExtractMapsData(url, () => {
        if (onRefresh) onRefresh();
        
        const response = `Successfully extracted current Google Maps data including your location, search results, route information, map settings, and visible area details. This information has been captured and is now available for analysis.`;
        
        console.log(`✅ Maps data extraction completed`);
        resolve(response);
      }).catch((error) => {
        const errorMsg = `Failed to extract Maps data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ Data extraction failed:`, errorMsg);
        resolve(errorMsg);
      });
    });
  }

  /**
   * Execute result analysis tool with actual data analysis
   */
  private static async executeResultAnalysis(url: string, focus?: string, onRefresh?: () => void): Promise<string> {
    return new Promise(async (resolve) => {
      console.log(`🔍 Analyzing current Maps results with focus: ${focus || 'general'}`);
      
      try {
        // Get the current Maps data from storage
        const response = await chrome.runtime.sendMessage({
          action: 'getMapsDataStatus',
          url: url
        });

        if (response.success && response.status && response.status.mapsData) {
          const mapsData = response.status.mapsData;
          console.log('📊 Analyzing Maps data:', mapsData);
          
          let analysis = '';
          
          // Analyze search results if available
          if (mapsData.searchResults && mapsData.searchResults.length > 0) {
            const results = mapsData.searchResults;
            const topResults = results; // Show all results instead of limiting to 5
            
            analysis += `Great! I found ${results.length} places`;
            if (mapsData.searchQuery) {
              analysis += ` for "${mapsData.searchQuery}"`;
            }
            analysis += `. Here are the options:\n\n`;
            
                         topResults.forEach((place: any, index: number) => {
              analysis += `**${index + 1}. ${place.name}**\n`;
              if (place.rating) {
                analysis += `⭐ ${place.rating} stars`;
                if (place.reviewCount) {
                  analysis += ` (${place.reviewCount} reviews)`;
                }
                analysis += '\n';
              }
              if (place.address) {
                analysis += `📍 ${place.address}\n`;
              }
              if (place.priceLevel) {
                const priceSymbols = '$'.repeat(place.priceLevel);
                analysis += `💰 ${priceSymbols}\n`;
              }
              if (place.businessStatus) {
                analysis += `🕒 ${place.businessStatus}\n`;
              }
              analysis += '\n';
            });
            
            // Add recommendations based on ratings
                         const highRated = topResults.filter((p: any) => p.rating && p.rating >= 4.0);
            if (highRated.length > 0) {
              const best = highRated[0];
              analysis += `🏆 **Top Recommendation**: ${best.name}`;
              if (best.rating) {
                analysis += ` (${best.rating}⭐)`;
              }
              analysis += ` stands out for its excellent ratings`;
              if (best.reviewCount && best.reviewCount > 50) {
                analysis += ` and strong review count`;
              }
              analysis += '.\n\n';
            }
            
            // Distance/location analysis
            if (mapsData.currentLocation) {
              analysis += `📍 All results are shown relative to your current location. `;
            }
            
            analysis += `Would you like directions to any of these places, or would you like me to search for something more specific?`;
            
          } else if (mapsData.currentRoute) {
            // Analyze route information
            const route = mapsData.currentRoute;
            analysis = `🗺️ **Current Route Analysis**:\n\n`;
            analysis += `**From**: ${route.origin.address}\n`;
            analysis += `**To**: ${route.destination.address}\n`;
            analysis += `**Distance**: ${route.distance}\n`;
            analysis += `**Duration**: ${route.duration}\n\n`;
            analysis += `The route is optimized for your current travel preferences. `;
            
          } else {
            // No specific results to analyze
            analysis = `I can see the current Google Maps view`;
            if (mapsData.currentLocation) {
              analysis += ` centered around your location`;
            }
            analysis += `. There don't appear to be any search results currently displayed. Try searching for specific places, restaurants, or services to get detailed recommendations!`;
          }
          
          console.log(`✅ Result analysis completed with actual data`);
          resolve(analysis);
          
        } else {
          // Fallback to generic analysis
          console.log('⚠️ No Maps data available, using generic analysis');
          const analysisType = focus || 'general';
          let response = `I can see the current Google Maps view. `;
          
          switch (analysisType) {
            case 'restaurants':
              response += `For restaurant recommendations, I'd suggest searching for specific cuisines or restaurant types to get detailed options with ratings and reviews.`;
              break;
            case 'ratings':
              response += `To analyze ratings, please search for specific places first so I can compare the options and highlight the best-rated establishments.`;
              break;
            default:
              response += `Try searching for specific places or services to get detailed analysis and recommendations.`;
          }
          
          resolve(response);
        }
        
      } catch (error) {
        console.error('❌ Result analysis error:', error);
        const errorMsg = `I'm having trouble accessing the current Maps data. ${error instanceof Error ? error.message : 'Unknown error'}`;
        resolve(errorMsg);
      }
      
      // Call onRefresh if provided
      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 100);
      }
    });
  }

  /**
   * Get benefits description for different map view types
   */
  private static getViewBenefits(mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'): string {
    switch (mapType) {
      case 'roadmap':
        return 'navigation, finding addresses, and seeing street names clearly';
      case 'satellite':
        return 'seeing actual buildings, parking lots, and real-world features from above';
      case 'hybrid':
        return 'combining the detail of satellite imagery with the navigation utility of street labels';
      case 'terrain':
        return 'understanding elevation changes, hiking trails, and natural geographic features';
      default:
        return 'exploring the area';
    }
  }

  /**
   * Enhanced tool execution with context awareness
   * This method can be used for more intelligent tool orchestration
   */
  static async executeToolCallWithContext(
    toolCall: ToolCall, 
    url: string | null, 
    conversationContext: string,
    onRefresh?: () => void
  ): Promise<string> {
    // For now, this delegates to the standard execution
    // But it could be enhanced to make smarter decisions based on conversation context
    const result = await this.executeToolCall(toolCall, url, onRefresh);
    
    // Add contextual information based on the tool and conversation
    if (toolCall.function.name === 'search_maps' && conversationContext.toLowerCase().includes('best')) {
      return result + ' I\'ve found several options - I can help you identify the highest-rated ones if you\'d like!';
    }
    
    if (toolCall.function.name === 'get_directions' && conversationContext.toLowerCase().includes('best')) {
      return result + ' You\'re all set to head to what looks like a great choice based on the ratings and reviews!';
    }
    
    return result;
  }

  /**
   * Get system prompt for Maps assistant
   */
  static getSystemPrompt(): string {
    return `You are a helpful Google Maps assistant that can control Google Maps when needed and provide conversational responses.

IMPORTANT: Only use tools when the user specifically requests actions to be performed. For general questions, opinions, or recommendations, respond conversationally without using tools.

WHEN TO USE TOOLS:
- User asks to search for specific places: "find pizza", "search for gas stations"
- User wants directions: "navigate to", "directions to", "take me to"
- User wants map controls: "zoom in", "satellite view", "change view"
- User asks for specific actions: "extract data", "get current info"

WHEN NOT TO USE TOOLS:
- User asks for opinions: "what do you think", "what should I eat"
- User asks for recommendations without action: "any suggestions", "what's good"
- General conversation: "thanks", "what do you prefer"
- User asks about places already visible on the map

AVAILABLE TOOLS:
- search_maps: Search for places, businesses, or locations
- get_directions: Get directions to destinations
- zoom_map: Zoom in or out on the map
- change_map_view: Switch between roadmap, satellite, hybrid, terrain views
- pan_to_location: Pan to specific coordinates
- extract_maps_data: Get current map information
- analyze_current_results: Analyze current search results

RESPONSE STYLE:
- Be conversational and helpful
- Explain what you're doing when using tools
- Provide specific recommendations with actual place names and details
- Ask follow-up questions to be more helpful

EXAMPLE INTERACTIONS:

User: "find good sushi restaurants"
Response: "I'll search for sushi restaurants in your area!" 
[Uses search_maps tool]
Then: "Great! I found several excellent sushi spots. Based on the results, [Restaurant Name] stands out with 4.8 stars and great reviews for their fresh fish. [Another Restaurant] also looks promising with 4.6 stars. Would you like directions to either of these?"

User: "what do you think about the pizza places here?"
Response: "Based on what I can see, there are several good options! I'd be happy to help you decide - what kind of pizza experience are you looking for? Are you in the mood for something casual and quick, or a sit-down place? And do you prefer thin crust, deep dish, or something else?"

User: "navigate to the best rated pizza place"
Response: "I'll search for pizza places first to find the highest rated one, then get you directions!"
[Uses search_maps tool]
Then: "Perfect! [Restaurant Name] is the top-rated pizza place with [rating] stars. Let me get you directions there now."
[Uses get_directions tool]

Remember: Only use tools when the user wants specific actions performed. For opinions, recommendations, or general conversation, respond naturally without tools.`;
  }
}

// Export convenience functions
export const getMapsTools = MapsToolsService.getTools.bind(MapsToolsService);
export const executeMapsToolCall = MapsToolsService.executeToolCall.bind(MapsToolsService);
export const getMapsSystemPrompt = MapsToolsService.getSystemPrompt.bind(MapsToolsService); 