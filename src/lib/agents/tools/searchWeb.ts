import type { AgentTool } from './types';
import { searchWeb } from '../../services/groqService.svelte';

export const searchWebTool: AgentTool = {
  name: 'web_search',
  description: 'Search the web for information using Groq\'s compound-beta model with real-time web search capabilities',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      excludeDomains: {
        type: 'array',
        description: 'List of domains to exclude from search results (supports wildcards like *.com)'
      },
      includeDomains: {
        type: 'array',
        description: 'Restrict search to only these domains (supports wildcards like *.edu)'
      },
      country: {
        type: 'string',
        description: 'Boost search results from a specific country'
      },
      model: {
        type: 'string',
        enum: ['compound-beta', 'compound-beta-mini'],
        description: 'Which compound model to use (compound-beta-mini is 3x faster but supports single tool calls)'
      }
    },
    required: ['query']
  },
  func: async (params: { 
    query: string; 
    excludeDomains?: string[];
    includeDomains?: string[];
    country?: string;
    model?: 'compound-beta' | 'compound-beta-mini';
  }) => {
    try {
      console.log('🔍 Executing web search tool with query:', params.query);
      
      const searchResult = await searchWeb(params.query, {
        excludeDomains: params.excludeDomains,
        includeDomains: params.includeDomains,
        country: params.country,
        model: params.model || 'compound-beta-mini'
      });

      if (!searchResult.success) {
        console.error('❌ Web search failed:', searchResult.error);
        return [
          {
            type: 'tool_result' as const,
            data: { 
              query: params.query, 
              error: searchResult.error,
              success: false
            }
          },
          {
            type: 'component' as const,
            name: 'SearchResults',
            props: {
              query: params.query,
              results: [],
              count: 0,
              error: searchResult.error
            }
          }
        ];
      }

      // Extract search results from executed tools if available
      const searchResults = [];
      let compoundBetaSearchResults = null;
      
      if (searchResult.executedTools && searchResult.executedTools.length > 0) {
        for (const tool of searchResult.executedTools) {
          if (tool.type === 'search' && tool.search_results) {
            // Compound beta format with search_results
            compoundBetaSearchResults = tool.search_results;
            searchResults.push(...tool.search_results.results.map((result: any) => ({
              title: result.title || 'No title',
              url: result.url || '',
              snippet: result.snippet || result.content || 'No snippet available',
              score: result.score
            })));
          } else if (tool.type === 'web_search' && tool.results) {
            // Legacy format
            searchResults.push(...tool.results.map((result: any) => ({
              title: result.title || 'No title',
              url: result.url || '',
              snippet: result.snippet || result.content || 'No snippet available'
            })));
          }
        }
      }

      console.log('✅ Web search completed successfully');
      console.log('📊 Search results:', searchResults.length, 'results found');
      console.log('🔧 Executed tools:', searchResult.executedTools?.length || 0);

      return [
        {
          type: 'tool_result' as const,
          data: { 
            query: params.query, 
            content: searchResult.content,
            results: searchResults,
            count: searchResults.length,
            executedTools: searchResult.executedTools,
            success: true
          }
        },
        {
          type: 'component' as const,
          name: 'SearchResults',
          props: {
            query: params.query,
            results: searchResults,
            count: searchResults.length,
            content: searchResult.content,
            executedTools: searchResult.executedTools,
            search_results: compoundBetaSearchResults
          }
        }
      ];

    } catch (error) {
      console.error('❌ Web search tool error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return [
        {
          type: 'tool_result' as const,
          data: { 
            query: params.query, 
            error: errorMessage,
            success: false
          }
        },
        {
          type: 'component' as const,
          name: 'SearchResults',
          props: {
            query: params.query,
            results: [],
            count: 0,
            error: errorMessage
          }
        }
      ];
    }
  }
}; 