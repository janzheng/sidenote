import type { AgentTool } from '../types';
import { mapsManager } from '../../../ui/mapsManager.svelte';
import { getCurrentMapsTabUrl, getMapsData } from './utils';

export const exploreAreaTool: AgentTool = {
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
        const topResults = results; // Show all results instead of limiting to 8
        
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
}; 