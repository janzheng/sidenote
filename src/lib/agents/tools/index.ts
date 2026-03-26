import type { AgentTool } from './types';
import type { AgentContent } from '../registry.svelte';
import { sanitize } from '../registry.svelte';

// Import all tools
import { mapsTools as gmapsMapsTools } from './gmaps';
import { getWeatherByLocationTool } from './getWeatherByLocation';
import { searchWebTool } from './searchWeb';
import { showStatusTool } from './showStatus';
import { analyzePageTool } from './analyzePage';

// Export types
export type { AgentTool } from './types';

// Export utility functions
export { getCurrentMapsTabUrl, getMapsData } from './gmaps';

// Enhanced Maps tools for ReAct agent
export const mapsTools: AgentTool[] = gmapsMapsTools;

// Example tools for testing (keeping existing ones)
export const exampleTools: AgentTool[] = [
  getWeatherByLocationTool,
  searchWebTool,
  showStatusTool,
  analyzePageTool
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
  console.log(`🔧 executeToolCall called with:`, { toolName, params, paramsType: typeof params });
  
  const allTools = [...exampleTools, ...mapsTools];
  const tool = allTools.find(t => t.name === toolName);
  
  if (!tool) {
    return [{
      type: 'comment',
      text: sanitize(`❌ Unknown tool: ${toolName}`)
    }];
  }
  
  try {
    console.log(`🔧 Calling ${toolName}.func with params:`, params);

    // Wrap tool execution with a timeout to prevent hanging
    const TOOL_TIMEOUT_MS = 30000; // 30 second timeout
    const result = await Promise.race([
      tool.func(params, signal),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`Tool "${toolName}" timed out after ${TOOL_TIMEOUT_MS / 1000}s`)), TOOL_TIMEOUT_MS);
        // If signal is already aborted or gets aborted, reject immediately
        if (signal?.aborted) {
          clearTimeout(timer);
          reject(new Error('Tool execution aborted'));
        }
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Tool execution aborted'));
        });
      })
    ]);
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