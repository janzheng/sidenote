import type { AgentContent } from './registry.svelte';
import { sanitize } from './registry.svelte';
import { mapsManager } from '../ui/mapsManager.svelte';

// Tool function signature
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  func: (params: any, signal?: AbortSignal) => Promise<AgentContent | AgentContent[]>;
}

// Get current active Google Maps tab URL
async function getCurrentMapsTabUrl(): Promise<string | null> {
  try {
    // First try to get active tab in current window
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url && mapsManager.isGoogleMapsUrl(tabs[0].url)) {
      console.log('🗺️ Found active Maps tab:', tabs[0].url);
      return tabs[0].url;
    }
    
    // If active tab is not Maps, look for any Google Maps tabs
    const allTabs = await chrome.tabs.query({});
    const mapsTabs = allTabs.filter(tab => 
      tab.url && mapsManager.isGoogleMapsUrl(tab.url)
    );
    
    if (mapsTabs.length > 0 && mapsTabs[0].url) {
      console.log('🗺️ Found Maps tab:', mapsTabs[0].url);
      return mapsTabs[0].url;
    }
    
    console.log('🗺️ No active Maps tabs found');
    return null;
  } catch (error) {
    console.error('❌ Failed to get current Maps tab:', error);
    return null;
  }
}

// Get Maps data for context
async function getMapsData(url: string): Promise<any> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getMapsDataStatus',
      url: url
    });

    if (response.success && response.mapsData) {
      return response.mapsData;
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to get Maps data:', error);
    return null;
  }
}

// Enhanced Maps tools for ReAct agent
export const mapsTools: AgentTool[] = [
  {
    name: 'find_places_nearby',
    description: 'Find places, restaurants, or services in an area. Use this for queries like "find good pizza nearby", "what restaurants are around here", "coffee shops in this area".',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for (e.g., "pizza restaurants", "coffee shops", "gas stations", "grocery stores")'
        },
        area: {
          type: 'string',
          description: 'Optional specific area or location to search in (if not provided, uses current map location)'
        }
      },
      required: ['query']
    },
    func: async (params: { query: string; area?: string }) => {
      const url = await getCurrentMapsTabUrl();
      if (!url) {
        return {
          type: 'comment',
          text: 'Please open Google Maps first to search for places nearby.'
        };
      }

      try {
        // If area is specified, search for "query in area", otherwise just query
        const searchQuery = params.area ? `${params.query} in ${params.area}` : params.query;
        
        console.log(`🔍 Searching for: "${searchQuery}"`);
        
        // Execute the search
        await mapsManager.search(url, searchQuery, () => {
          console.log(`✅ Search completed for: "${searchQuery}"`);
        });
        
        // Wait for results to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Extract data to analyze results
        await mapsManager.handleExtractMapsData(url, () => {
          console.log('✅ Data extraction completed');
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the Maps data
        const mapsData = await getMapsData(url);
        
        if (mapsData && mapsData.searchResults && mapsData.searchResults.length > 0) {
          const results = mapsData.searchResults;
          const topResults = results.slice(0, 5);
          
          let analysis = `Found ${results.length} places for "${params.query}"`;
          if (params.area) {
            analysis += ` in ${params.area}`;
          }
          analysis += ':\n\n';
          
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
            analysis += '\n';
          });
          
          // Add top recommendation
          const highRated = topResults.filter((p: any) => p.rating && p.rating >= 4.0);
          if (highRated.length > 0) {
            const best = highRated[0];
            analysis += `🏆 **Top Pick**: ${best.name} (${best.rating}⭐) stands out for its excellent ratings.\n\n`;
          }
          
          analysis += 'Would you like directions to any of these places?';
          
          return {
            type: 'text',
            content: analysis
          };
        } else {
          return {
            type: 'text',
            content: `I searched for "${params.query}" but couldn't find detailed results. The search results should now be visible on the Google Maps interface.`
          };
        }
      } catch (error) {
        return {
          type: 'comment',
          text: `Failed to search for places: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  {
    name: 'get_directions_to',
    description: 'Get directions to a specific place or address. Use this when someone wants to navigate somewhere.',
    parameters: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Where to go (address, business name, or landmark)'
        },
        from: {
          type: 'string',
          description: 'Starting point (optional, defaults to current location)'
        }
      },
      required: ['destination']
    },
    func: async (params: { destination: string; from?: string }) => {
      const url = await getCurrentMapsTabUrl();
      if (!url) {
        return {
          type: 'comment',
          text: 'Please open Google Maps first to get directions.'
        };
      }

      try {
        console.log(`🧭 Getting directions to: "${params.destination}"`);
        
        await mapsManager.getDirections(url, params.destination, params.from, () => {
          console.log(`✅ Directions opened for: "${params.destination}"`);
        });
        
        const fromText = params.from ? ` from ${params.from}` : ' from your current location';
        const response = `🧭 **Directions Ready!**\n\nI've opened directions to **${params.destination}**${fromText}. You can now see:\n\n• Turn-by-turn navigation\n• Estimated travel time\n• Distance information\n• Real-time traffic updates\n\nThe route is displayed on Google Maps with all the details you need for your journey.`;
        
        return {
          type: 'text',
          content: response
        };
      } catch (error) {
        return {
          type: 'comment',
          text: `Failed to get directions: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  {
    name: 'explore_area',
    description: 'Get information about what\'s interesting in a specific area - restaurants, attractions, things to do. Use this for exploratory questions like "what\'s good to eat around here", "what is there to do in this area".',
    parameters: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          description: 'The area to explore (neighborhood, city, or "here" for current location)'
        },
        category: {
          type: 'string',
          description: 'What to look for: food, entertainment, shopping, attractions, etc.',
          enum: ['food', 'restaurants', 'entertainment', 'attractions', 'shopping', 'services', 'general']
        }
      },
      required: ['area']
    },
    func: async (params: { area: string; category?: string }) => {
      const url = await getCurrentMapsTabUrl();
      if (!url) {
        return {
          type: 'comment',
          text: 'Please open Google Maps first to explore the area.'
        };
      }

      try {
        const category = params.category || 'general';
        let searchQuery = '';
        
        // Build search query based on category
        switch (category) {
          case 'food':
          case 'restaurants':
            searchQuery = `restaurants in ${params.area}`;
            break;
          case 'entertainment':
            searchQuery = `entertainment in ${params.area}`;
            break;
          case 'attractions':
            searchQuery = `attractions in ${params.area}`;
            break;
          case 'shopping':
            searchQuery = `shopping in ${params.area}`;
            break;
          case 'services':
            searchQuery = `services in ${params.area}`;
            break;
          default:
            searchQuery = `points of interest in ${params.area}`;
        }
        
        console.log(`🔍 Exploring area: "${searchQuery}"`);
        
        // Execute the search
        await mapsManager.search(url, searchQuery, () => {
          console.log(`✅ Area exploration completed for: "${searchQuery}"`);
        });
        
        // Wait for results and extract data
        await new Promise(resolve => setTimeout(resolve, 2000));
        await mapsManager.handleExtractMapsData(url, () => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mapsData = await getMapsData(url);
        
        if (mapsData && mapsData.searchResults && mapsData.searchResults.length > 0) {
          const results = mapsData.searchResults;
          const topResults = results.slice(0, 8); // Show more for exploration
          
          let analysis = `🗺️ **Exploring ${params.area}**\n\n`;
          
          if (category === 'food' || category === 'restaurants') {
            analysis += `Here are some great dining options:\n\n`;
          } else if (category === 'attractions') {
            analysis += `Here are interesting attractions and places to visit:\n\n`;
          } else {
            analysis += `Here's what I found in the area:\n\n`;
          }
          
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
            analysis += '\n';
          });
          
          // Add variety analysis
          const categories = [...new Set(topResults.map((p: any) => p.types?.[0] || 'place'))];
          if (categories.length > 1) {
            analysis += `You have good variety here with ${categories.length} different types of places. `;
          }
          
          analysis += 'Would you like directions to any of these places, or should I search for something more specific?';
          
          return {
            type: 'text',
            content: analysis
          };
        } else {
          // Provide knowledge-based response as fallback
          let knowledgeResponse = `🗺️ **About ${params.area}**\n\n`;
          
          if (category === 'food' || category === 'restaurants') {
            knowledgeResponse += `For dining in ${params.area}, I'd recommend looking for:\n\n• Local favorites and highly-rated restaurants\n• Different cuisine types to suit your taste\n• Places with good reviews and ratings\n• Consider your budget and dining style preference\n\nWould you like me to search for a specific type of cuisine or restaurant?`;
          } else {
            knowledgeResponse += `${params.area} likely has various points of interest. I'd suggest searching for specific categories like:\n\n• Restaurants and cafes\n• Shopping areas\n• Parks and recreation\n• Local attractions\n• Entertainment venues\n\nWhat specifically interests you most?`;
          }
          
          return {
            type: 'text',
            content: knowledgeResponse
          };
        }
      } catch (error) {
        return {
          type: 'comment',
          text: `Failed to explore area: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  {
    name: 'go_home',
    description: 'Navigate to home location or get directions home. Use this when someone wants to go home.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Starting point (optional, defaults to current location)'
        }
      },
      required: []
    },
    func: async (params: { from?: string }) => {
      const url = await getCurrentMapsTabUrl();
      if (!url) {
        return {
          type: 'comment',
          text: 'Please open Google Maps first to get directions home.'
        };
      }

      try {
        console.log('🏠 Getting directions home');
        
        await mapsManager.getDirections(url, 'Home', params.from, () => {
          console.log('✅ Directions home opened');
        });
        
        const fromText = params.from ? ` from ${params.from}` : ' from your current location';
        const response = `🏠 **Heading Home!**\n\nI've opened directions to your home${fromText}. The route is now displayed with:\n\n• Turn-by-turn navigation\n• Estimated arrival time\n• Current traffic conditions\n• Alternative routes if available\n\nSafe travels!`;
        
        return {
          type: 'text',
          content: response
        };
      } catch (error) {
        return {
          type: 'comment',
          text: `Failed to get directions home: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  {
    name: 'clear_directions',
    description: 'Clear/exit current directions to get back to normal map view. Use this when directions are open and you need to search for new places or when the map seems stuck in directions mode.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    func: async (params: {}) => {
      const url = await getCurrentMapsTabUrl();
      if (!url) {
        return {
          type: 'comment',
          text: 'Please open Google Maps first to clear directions.'
        };
      }

      try {
        console.log('❌ Clearing directions');
        
        await mapsManager.clearDirections(url, () => {
          console.log('✅ Directions cleared');
        });
        
        const response = `❌ **Directions Cleared!**\n\nI've exited the directions mode and returned to the normal map view. You can now:\n\n• Search for new places\n• Explore different areas\n• Get fresh directions to other locations\n• View the map without route overlays\n\nThe map is ready for your next search or navigation request!`;
        
        return {
          type: 'text',
          content: response
        };
      } catch (error) {
        return {
          type: 'comment',
          text: `Failed to clear directions: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  {
    name: 'change_map_view',
    description: 'Change how the map is displayed - satellite, road, terrain, or hybrid view. Use this when someone wants to see the map differently.',
    parameters: {
      type: 'object',
      properties: {
        view_type: {
          type: 'string',
          description: 'The type of map view to switch to',
          enum: ['satellite', 'road', 'terrain', 'hybrid']
        }
      },
      required: ['view_type']
    },
    func: async (params: { view_type: string }) => {
      const url = await getCurrentMapsTabUrl();
      if (!url) {
        return {
          type: 'comment',
          text: 'Please open Google Maps first to change the view.'
        };
      }

      try {
        // Convert to the format expected by mapsManager
        const mapType = params.view_type === 'road' ? 'roadmap' : params.view_type as 'satellite' | 'hybrid' | 'terrain';
        
        console.log(`🗺️ Changing map view to: ${mapType}`);
        
        await mapsManager.changeMapType(url, mapType, () => {
          console.log(`✅ Map view changed to: ${mapType}`);
        });
        
        const viewDescriptions = {
          roadmap: 'standard road map with streets and labels',
          satellite: 'satellite imagery showing aerial photos',
          hybrid: 'satellite imagery with road labels overlay',
          terrain: 'topographical view with elevation and terrain features'
        };
        
        const benefits = {
          roadmap: 'Perfect for navigation and finding addresses',
          satellite: 'Great for seeing actual buildings and landmarks',
          hybrid: 'Best of both worlds - satellite detail with navigation labels',
          terrain: 'Ideal for understanding elevation and natural features'
        };
        
        const response = `🗺️ **Map View Changed!**\n\nSwitched to **${params.view_type}** view - ${viewDescriptions[mapType]}.\n\n${benefits[mapType]}. You can now see the area with this enhanced perspective!`;
        
        return {
          type: 'text',
          content: response
        };
      } catch (error) {
        return {
          type: 'comment',
          text: `Failed to change map view: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  {
    name: 'zoom_map',
    description: 'Zoom in or out on the map to see more or less detail. Use this when someone wants to see a closer or wider view.',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          description: 'Direction to zoom',
          enum: ['in', 'out', 'closer', 'further']
        }
      },
      required: ['direction']
    },
    func: async (params: { direction: string }) => {
      const url = await getCurrentMapsTabUrl();
      if (!url) {
        return {
          type: 'comment',
          text: 'Please open Google Maps first to zoom the map.'
        };
      }

      try {
        // Normalize direction
        const zoomDirection = (params.direction === 'closer' || params.direction === 'in') ? 'in' : 'out';
        
        console.log(`🔍 Zooming ${zoomDirection}`);
        
        const zoomFunction = zoomDirection === 'in' ? mapsManager.zoomIn : mapsManager.zoomOut;
        await zoomFunction.call(mapsManager, url, () => {
          console.log(`✅ Zoom ${zoomDirection} completed`);
        });
        
        const response = zoomDirection === 'in' 
          ? `🔍 **Zoomed In!**\n\nYou now have a closer, more detailed view showing:\n• Street-level details\n• Individual buildings\n• Specific landmarks\n• More precise locations`
          : `🔍 **Zoomed Out!**\n\nYou now have a wider view showing:\n• Broader area coverage\n• Regional context\n• Multiple neighborhoods\n• General geographic layout`;
        
        return {
          type: 'text',
          content: response
        };
      } catch (error) {
        return {
          type: 'comment',
          text: `Failed to zoom map: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  }
];

// Example tools for testing (keeping existing ones)
export const exampleTools: AgentTool[] = [
  {
    name: 'get_weather_by_location',
    description: 'Get current weather information for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state/country to get weather for (must be specific, no placeholders like [location])'
        }
      },
      required: ['location']
    },
    func: async (params: { location: string }) => {
      // Validate location is not a placeholder or too short
      if (!params.location || params.location.length < 2 || 
          params.location.includes('[') || params.location.includes(']') ||
          params.location.toLowerCase().includes('location') ||
          params.location.toLowerCase().includes('placeholder')) {
        return {
          type: 'comment' as const,
          text: `⚠️ Invalid location "${params.location}". Please provide a specific city name, not a placeholder.`
        };
      }
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock weather data
      const mockWeather = {
        temp_c: Math.floor(Math.random() * 30) + 5,
        condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)],
        location: params.location,
        ts: new Date().toISOString()
      };
      
      return [
        {
          type: 'tool_result' as const,
          data: mockWeather
        },
        {
          type: 'component' as const,
          name: 'WeatherCard',
          props: mockWeather
        }
      ];
    }
  },
  
  {
    name: 'search_web',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)'
        }
      },
      required: ['query']
    },
    func: async (params: { query: string; limit?: number }) => {
      // Simulate search delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const limit = params.limit || 5;
      const mockResults = Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
        title: `Result ${i + 1} for "${params.query}"`,
        url: `https://example.com/result-${i + 1}`,
        snippet: `This is a mock search result snippet for ${params.query}. It contains relevant information about the query.`
      }));
      
      return [
        {
          type: 'tool_result' as const,
          data: { query: params.query, results: mockResults, count: mockResults.length }
        },
        {
          type: 'component' as const,
          name: 'SearchResults',
          props: {
            query: params.query,
            results: mockResults,
            count: mockResults.length
          }
        }
      ];
    }
  },
  
  {
    name: 'show_status',
    description: 'Display a status message to the user',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['success', 'error', 'warning', 'info'],
          description: 'The status type'
        },
        message: {
          type: 'string',
          description: 'The status message'
        },
        details: {
          type: 'string',
          description: 'Optional additional details'
        }
      },
      required: ['status', 'message']
    },
    func: async (params: { status: string; message: string; details?: string }) => {
      return {
        type: 'component' as const,
        name: 'StatusCard',
        props: params
      };
    }
  },
  
  {
    name: 'analyze_page',
    description: 'Analyze the current page content and provide insights',
    parameters: {
      type: 'object',
      properties: {
        aspect: {
          type: 'string',
          description: 'What aspect to analyze (content, structure, performance, etc.)'
        }
      },
      required: ['aspect']
    },
    func: async (params: { aspect: string }) => {
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const insights = [
        `Analyzed ${params.aspect} of the current page`,
        `Found ${Math.floor(Math.random() * 10) + 1} key insights`,
        `Performance score: ${Math.floor(Math.random() * 40) + 60}/100`,
        `Recommendations: Optimize images, reduce bundle size, improve accessibility`
      ];
      
      return {
        type: 'text' as const,
        content: insights.join('\n\n')
      };
    }
  }
];

// Get tools for the agent (now includes Maps tools)
export function getAgentTools(): AgentTool[] {
  return [...exampleTools, ...mapsTools];
}

// Get only Maps tools for Maps-specific agent
export function getMapsTools(): AgentTool[] {
  return mapsTools;
}

// Execute a tool call
export async function executeToolCall(
  toolName: string, 
  params: any, 
  signal?: AbortSignal
): Promise<AgentContent[]> {
  const allTools = [...exampleTools, ...mapsTools];
  const tool = allTools.find(t => t.name === toolName);
  
  if (!tool) {
    return [{
      type: 'comment',
      text: sanitize(`❌ Unknown tool: ${toolName}`)
    }];
  }
  
  try {
    const result = await tool.func(params, signal);
    const items = Array.isArray(result) ? result : [result];
    
    // Validate each item
    const validItems: AgentContent[] = [];
    for (const item of items) {
      // Basic validation - in a real implementation you'd use AgentContent.safeParse
      if (item && typeof item === 'object' && 'type' in item) {
        validItems.push(item as AgentContent);
      } else {
        console.warn('Invalid tool output:', item);
        validItems.push({
          type: 'comment',
          text: sanitize('⚠️ Tool returned invalid data')
        });
      }
    }
    
    return validItems;
    
  } catch (error) {
    console.error(`Tool ${toolName} error:`, error);
    return [{
      type: 'comment',
      text: sanitize(`❌ Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }];
  }
} 