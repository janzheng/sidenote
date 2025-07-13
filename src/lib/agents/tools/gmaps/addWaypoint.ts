import type { AgentTool } from '../types';

export const addWaypoint: AgentTool = {
  name: 'add_waypoint',
  description: 'Add a waypoint (intermediate stop) to the current Google Maps route for multi-leg trips',
  parameters: {
    type: 'object',
    properties: {
      waypoint: {
        type: 'string',
        description: 'The address or name of the waypoint to add to the route'
      },
      position: {
        type: 'number',
        description: 'Optional position index where to insert the waypoint (0-based). If not provided, adds to the end.'
      }
    },
    required: ['waypoint']
  },
  async func(params: { waypoint: string; position?: number }) {
    try {
      console.log('🗺️ Adding waypoint:', params.waypoint);
      
      // Send message to content script to add waypoint
      const response = await chrome.runtime.sendMessage({
        action: 'controlMaps',
        command: {
          action: 'add_waypoint',
          params: {
            waypoint: params.waypoint,
            position: params.position
          }
        }
      });
      
      if (response.success) {
        return {
          type: 'tool_result',
          data: {
            success: true,
            message: `Added waypoint "${params.waypoint}" to the route`,
            result: response.result
          }
        };
      } else {
        return {
          type: 'tool_result',
          data: {
            success: false,
            message: `Failed to add waypoint: ${response.error}`,
            error: response.error
          }
        };
      }
    } catch (error) {
      console.error('❌ Add waypoint error:', error);
      return {
        type: 'tool_result',
        data: {
          success: false,
          message: 'Failed to add waypoint to route',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}; 