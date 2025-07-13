import type { AgentTool } from '../types';
import { mapsManager } from '../../../ui/mapsManager.svelte';
import { getCurrentMapsTabUrl } from './utils';

export const getDirectionsToTool: AgentTool = {
  name: 'get_directions_to',
  description: 'Get directions to a specific place or address. Can also handle multi-destination routes with waypoints. Use this when someone wants to navigate somewhere or plan a route with multiple stops.',
  parameters: {
    type: 'object',
    properties: {
      destination: {
        type: 'string',
        description: 'Final destination (address, business name, or landmark)'
      },
      from: {
        type: 'string',
        description: 'Starting point (optional, defaults to current location)'
      },
      waypoints: {
        type: 'string',
        description: 'Optional comma-separated intermediate stops/waypoints to visit before reaching the final destination (e.g., "Coffee Shop, Gas Station")'
      }
    },
    required: ['destination']
  },
  func: async (params: { destination: string; from?: string; waypoints?: string | string[] }) => {
    const url = await getCurrentMapsTabUrl();
    if (!url) {
      return {
        type: 'comment',
        text: 'Please open Google Maps first to get directions.'
      };
    }

    try {
      const { destination, from, waypoints } = params;
      
      // If waypoints are provided, create a multi-destination route
      if (waypoints) {
        // Handle both array and string waypoints
        let waypointArray: string[];
        
        if (Array.isArray(waypoints)) {
          waypointArray = waypoints.filter(wp => wp && wp.trim().length > 0);
        } else if (typeof waypoints === 'string' && waypoints.trim().length > 0) {
          waypointArray = waypoints.split(',').map(wp => wp.trim()).filter(wp => wp.length > 0);
        } else {
          waypointArray = [];
        }
        
        if (waypointArray.length > 0) {
          console.log(`🧭 Creating multi-destination route to: "${destination}" with ${waypointArray.length} waypoints`);
          
          // Construct Google Maps URL with waypoints
          const origin = from || 'My Location';
          const directionsUrl = `https://maps.google.com/maps/dir/${encodeURIComponent(origin)}/${waypointArray.map((w: string) => encodeURIComponent(w)).join('/')}/${encodeURIComponent(destination)}`;
          
          // Navigate to the multi-destination URL
          await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.update(tabs[0].id, { url: directionsUrl });
            }
          });
          
          const waypointsList = waypointArray.map((wp: string, i: number) => `${i + 1}. ${wp}`).join('\n');
          const fromText = from ? ` from ${from}` : ' from your current location';
          
          const response = `🧭 **Multi-Destination Route Created!**\n\nI've created a route${fromText} with the following stops:\n\n${waypointsList}\n\n**Final Destination:** ${destination}\n\nGoogle Maps will now show you the optimized route with all waypoints. You can:\n\n• See the complete multi-leg journey\n• Get turn-by-turn directions for each segment\n• View estimated times for each leg\n• Reorder stops if needed by dragging them in the interface\n\nThe route is optimized for your multi-destination trip!`;
          
          return {
            type: 'text',
            content: response
          };
        }
      }
      
      // Single destination route (existing functionality)
      console.log(`🧭 Getting directions to: "${destination}"`);
      
      await mapsManager.getDirections(url, destination, from, () => {
        console.log(`✅ Directions opened for: "${destination}"`);
      });
      
      const fromText = from ? ` from ${from}` : ' from your current location';
      const response = `🧭 **Directions Ready!**\n\nI've opened directions to **${destination}**${fromText}. You can now see:\n\n• Turn-by-turn navigation\n• Estimated travel time\n• Distance information\n• Real-time traffic updates\n\nThe route is displayed on Google Maps with all the details you need for your journey.`;
      
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
}; 