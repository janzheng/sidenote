import type { AgentTool } from '../types';
import { mapsManager } from '../../../ui/mapsManager.svelte';
import { getCurrentMapsTabUrl, getMapsData } from './utils';

export const findPlacesNearbyTool: AgentTool = {
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
        const topResults = results; // Show all results instead of limiting to 5
        
        let analysis = `🔍 **Found ${results.length} places near you**\n\n`;
        
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
        
        // Add recommendations based on ratings
        const highRated = topResults.filter((p: any) => p.rating && p.rating >= 4.0);
        if (highRated.length > 0) {
          const best = highRated[0];
          analysis += `🏆 **Top Pick**: ${best.name}`;
          if (best.rating) {
            analysis += ` (${best.rating}⭐)`;
          }
          analysis += ' looks like a great choice!\n\n';
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
}; 