import type { AgentTool } from '../types';
import { mapsManager } from '../../../ui/mapsManager.svelte';
import { getCurrentMapsTabUrl } from './utils';

export const goHomeTool: AgentTool = {
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
}; 