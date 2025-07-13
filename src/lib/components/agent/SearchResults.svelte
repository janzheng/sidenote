<script lang="ts">
  interface SearchResult {
    title: string;
    url: string;
    snippet?: string;
    content?: string;
    score?: number;
  }

  interface ExecutedTool {
    index: number;
    type: string;
    arguments: string;
    output: string;
  }

  interface SearchResults {
    results: SearchResult[];
  }

  interface Props {
    query: string;
    results: SearchResult[];
    count: number;
    error?: string;
    content?: string;
    executedTools?: ExecutedTool[];
    search_results?: SearchResults;
  }

  let { query, results, count, error, content, executedTools, search_results }: Props = $props();

  // Extract results from compound beta schema if available
  const displayResults = $derived(
    // If we have search_results from compound beta, use those
    search_results?.results && search_results.results.length > 0
      ? search_results.results.map(result => ({
          title: result.title || 'No title',
          url: result.url || '',
          snippet: result.snippet || result.content || 'No snippet available',
          score: result.score
        }))
      : // Otherwise use the legacy results format
        results.map(result => ({
          title: result.title || 'No title',
          url: result.url || '',
          snippet: result.snippet || result.content || 'No snippet available',
          score: result.score
        }))
  );

  const displayCount = $derived(search_results?.results?.length || count || displayResults.length);
</script>

<div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
  <div class="mb-4">
    <h3 class="text-lg font-semibold text-gray-800 mb-1">Web Search Results</h3>
    <p class="text-sm text-gray-600">
      {#if error}
        <span class="text-red-600">Error searching for "{query}": {error}</span>
      {:else}
        Found {displayCount} result{displayCount !== 1 ? 's' : ''} for "<span class="font-medium">{query}</span>"
      {/if}
    </p>
  </div>
  
  {#if error}
    <div class="text-center py-8 text-red-500 bg-red-50 rounded-lg">
      <p class="font-medium">Search Error</p>
      <p class="text-sm mt-1">{error}</p>
    </div>
  {:else if content && displayResults.length === 0}
    <!-- Show AI-generated content when no structured results are available -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h4 class="text-blue-800 font-medium mb-2">AI-Generated Summary</h4>
      <div class="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  {:else}
    <!-- Show AI summary first if available -->
    {#if content && displayResults.length > 0}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 class="text-blue-800 font-medium mb-2">AI Summary</h4>
        <div class="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">{content}</div>
      </div>
    {/if}
  
    <!-- Show structured search results -->
    {#if displayResults.length > 0}
      <div class="space-y-4">
        <h4 class="text-gray-800 font-medium text-sm uppercase tracking-wide">Source Articles</h4>
        {#each displayResults as result, index (index)}
          <div class="border-l-4 border-blue-400 pl-4 bg-gray-50 rounded-r-lg p-3">
            <div class="flex items-start justify-between mb-2">
              <h5 class="text-blue-600 font-medium hover:underline cursor-pointer flex-1">
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  {result.title}
                </a>
              </h5>
              {#if result.score}
                <span class="text-xs text-gray-500 ml-2 bg-gray-200 px-2 py-1 rounded">
                  Score: {(result.score * 100).toFixed(1)}%
                </span>
              {/if}
            </div>
            <p class="text-xs text-green-600 mb-2 break-all">{result.url}</p>
            <p class="text-sm text-gray-700 leading-relaxed">{result.snippet}</p>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
  
  {#if displayResults.length === 0 && !error && !content}
    <div class="text-center py-8 text-gray-500">
      No results found for "{query}"
    </div>
  {/if}
  
  {#if executedTools && executedTools.length > 0}
    <div class="mt-4 pt-4 border-t border-gray-200">
      <details class="text-xs text-gray-500">
        <summary class="cursor-pointer hover:text-gray-700">
          Debug: {executedTools.length} tool{executedTools.length !== 1 ? 's' : ''} executed
        </summary>
        <div class="mt-2 space-y-2">
          {#each executedTools as tool, index}
            <div class="bg-gray-100 p-2 rounded text-xs">
              <div class="font-medium">Tool {tool.index}: {tool.type}</div>
              {#if tool.arguments}
                <div class="text-gray-600 mt-1">
                  <strong>Args:</strong> {tool.arguments}
                </div>
              {/if}
              {#if tool.output}
                <div class="text-gray-600 mt-1 max-h-20 overflow-y-auto">
                  <strong>Output:</strong> {tool.output.substring(0, 200)}{tool.output.length > 200 ? '...' : ''}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </details>
    </div>
  {/if}
</div> 