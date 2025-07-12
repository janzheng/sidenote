<script lang="ts">
  interface SearchResult {
    title: string;
    url: string;
    snippet: string;
  }

  interface Props {
    query: string;
    results: SearchResult[];
    count: number;
  }

  let { query, results, count }: Props = $props();
</script>

<div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
  <div class="mb-4">
    <h3 class="text-lg font-semibold text-gray-800 mb-1">Search Results</h3>
    <p class="text-sm text-gray-600">
      Found {count} result{count !== 1 ? 's' : ''} for "<span class="font-medium">{query}</span>"
    </p>
  </div>
  
  <div class="space-y-4">
    {#each results as result, index (index)}
      <div class="border-l-4 border-blue-400 pl-4">
        <h4 class="text-blue-600 font-medium hover:underline cursor-pointer mb-1">
          {result.title}
        </h4>
        <p class="text-xs text-green-600 mb-2">{result.url}</p>
        <p class="text-sm text-gray-700 leading-relaxed">{result.snippet}</p>
      </div>
    {/each}
  </div>
  
  {#if results.length === 0}
    <div class="text-center py-8 text-gray-500">
      No results found for "{query}"
    </div>
  {/if}
</div> 