import type { AgentTool } from './types';

export const showStatusTool: AgentTool = {
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
}; 