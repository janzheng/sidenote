import type { AgentTool } from '../types';
import { mapsManager } from '../../../ui/mapsManager.svelte';
import { getCurrentMapsTabUrl } from './utils';

export const zoomMapTool: AgentTool = {
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
}; 