import type { AgentTool } from '../types';
import { mapsManager } from '../../../ui/mapsManager.svelte';
import { getCurrentMapsTabUrl } from './utils';

export const changeMapViewTool: AgentTool = {
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
}; 