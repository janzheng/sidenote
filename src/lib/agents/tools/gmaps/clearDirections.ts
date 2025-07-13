import type { AgentTool } from '../types';
import { mapsManager } from '../../../ui/mapsManager.svelte';
import { getCurrentMapsTabUrl } from './utils';

export const clearDirectionsTool: AgentTool = {
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
}; 