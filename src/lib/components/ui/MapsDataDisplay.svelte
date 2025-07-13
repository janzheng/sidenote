<script lang="ts">
  import type { MapsData } from '../../../types/mapsData';
  import Icon from "@iconify/svelte";
  
  interface Props {
    mapsData: MapsData | null;
    showRawData?: boolean;
  }

  let { mapsData, showRawData = false }: Props = $props();

  // Helper function to format coordinates
  function formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  // Helper function to get travel mode icon
  function getTravelModeIcon(mode: string): string {
    const modeMap: Record<string, string> = {
      'driving': 'mdi:car',
      'walking': 'mdi:walk',
      'transit': 'mdi:bus',
      'cycling': 'mdi:bike',
      'Best travel modes': 'mdi:map-marker-path'
    };
    return modeMap[mode] || 'mdi:map-marker';
  }
</script>

{#if mapsData}
  <div class="maps-data-display space-y-4">
    <!-- Location Information -->
    {#if mapsData.currentLocation}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <Icon icon="mdi:map-marker" class="w-5 h-5 text-blue-600" />
          <h3 class="font-semibold text-blue-800">Current Location</h3>
        </div>
        <p class="text-sm text-blue-700">
          📍 {formatCoordinates(mapsData.currentLocation.lat, mapsData.currentLocation.lng)}
        </p>
        <p class="text-xs text-blue-600 mt-1">
          Zoom: {mapsData.zoomLevel}x • View: {mapsData.mapType}
        </p>
      </div>
    {/if}

    <!-- Search Information -->
    {#if mapsData.searchQuery}
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <Icon icon="mdi:magnify" class="w-5 h-5 text-green-600" />
          <h3 class="font-semibold text-green-800">Search Query</h3>
        </div>
        <p class="text-sm text-green-700">🔍 "{mapsData.searchQuery}"</p>
        {#if mapsData.searchResults.length > 0}
          <p class="text-xs text-green-600 mt-1">
            Found {mapsData.searchResults.length} results
          </p>
        {/if}
      </div>
    {/if}

    <!-- Route Information -->
    {#if mapsData.currentRoute}
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-3">
          <Icon icon="mdi:directions" class="w-5 h-5 text-purple-600" />
          <h3 class="font-semibold text-purple-800">Active Route</h3>
        </div>
        
        <!-- From/To/Waypoints -->
        <div class="space-y-2 mb-3">
          <div class="flex items-start gap-2">
            <Icon icon="mdi:map-marker" class="w-4 h-4 text-green-600 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-gray-800">From:</p>
              <p class="text-sm text-gray-600">{mapsData.currentRoute.origin.address}</p>
            </div>
          </div>
          
          <!-- Waypoints -->
          {#if mapsData.currentRoute.waypoints && mapsData.currentRoute.waypoints.length > 0}
            {#each mapsData.currentRoute.waypoints as waypoint, index}
              <div class="flex items-start gap-2">
                <Icon icon="mdi:map-marker-radius" class="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-gray-800">Stop {index + 1}:</p>
                  <p class="text-sm text-gray-600">{waypoint.address}</p>
                </div>
              </div>
            {/each}
          {/if}
          
          <div class="flex items-start gap-2">
            <Icon icon="mdi:map-marker-check" class="w-4 h-4 text-red-600 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-gray-800">To:</p>
              <p class="text-sm text-gray-600">{mapsData.currentRoute.destination.address}</p>
            </div>
          </div>
        </div>

        <!-- Duration & Distance -->
        <div class="flex gap-4 mb-3">
          {#if mapsData.currentRoute.duration}
            <div class="flex items-center gap-1">
              <Icon icon="mdi:clock" class="w-4 h-4 text-purple-600" />
              <span class="text-sm font-medium text-purple-700">{mapsData.currentRoute.duration}</span>
            </div>
          {/if}
          {#if mapsData.currentRoute.distance}
            <div class="flex items-center gap-1">
              <Icon icon="mdi:map-marker-distance" class="w-4 h-4 text-purple-600" />
              <span class="text-sm font-medium text-purple-700">{mapsData.currentRoute.distance}</span>
            </div>
          {/if}
        </div>

        <!-- Travel Modes -->
        {#if mapsData.currentRoute.travelModes && mapsData.currentRoute.travelModes.length > 0}
          <div class="mb-3">
            <p class="text-sm font-medium text-gray-800 mb-2">Travel Modes:</p>
            <div class="flex flex-wrap gap-2">
              {#each mapsData.currentRoute.travelModes as mode}
                <div class="flex items-center gap-1 px-2 py-1 rounded-full text-xs
                  {mode.isSelected ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-gray-100 text-gray-600'}">
                  <Icon icon={getTravelModeIcon(mode.mode)} class="w-3 h-3" />
                  <span>{mode.mode}</span>
                  {#if mode.duration}
                    <span class="text-xs opacity-75">({mode.duration})</span>
                  {/if}
                  {#if mode.isSelected}
                    <Icon icon="mdi:check" class="w-3 h-3" />
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Route Options -->
        {#if mapsData.currentRoute.routeOptions && mapsData.currentRoute.routeOptions.length > 1}
          <div class="mb-3">
            <p class="text-sm font-medium text-gray-800 mb-2">Route Options:</p>
            <div class="space-y-1">
              {#each mapsData.currentRoute.routeOptions as option, index}
                <div class="flex items-center justify-between px-2 py-1 bg-gray-50 rounded text-xs">
                  <div class="flex items-center gap-2">
                    <span class="w-4 h-4 bg-purple-200 text-purple-800 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span>{option.duration} • {option.distance}</span>
                  </div>
                  {#if option.description}
                    <span class="text-gray-500 text-xs">{option.description}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Route Steps Preview -->
        {#if mapsData.currentRoute.steps && mapsData.currentRoute.steps.length > 0}
          <div>
            <p class="text-sm font-medium text-gray-800 mb-2">
              Route Steps ({mapsData.currentRoute.steps.length} total):
            </p>
            <div class="space-y-1">
              {#each mapsData.currentRoute.steps.slice(0, 3) as step, index}
                <div class="flex items-start gap-2 text-xs">
                  <span class="w-4 h-4 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  <div class="flex-1">
                    <p class="text-gray-700">{step.instruction}</p>
                    {#if step.distance}
                      <p class="text-gray-500 text-xs">{step.distance}</p>
                    {/if}
                  </div>
                </div>
              {/each}
              {#if mapsData.currentRoute.steps.length > 3}
                <p class="text-xs text-gray-500 pl-6">
                  ... and {mapsData.currentRoute.steps.length - 3} more steps
                </p>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Search Results -->
    {#if mapsData.searchResults.length > 0}
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-3">
          <Icon icon="mdi:format-list-bulleted" class="w-5 h-5 text-yellow-600" />
          <h3 class="font-semibold text-yellow-800">Search Results ({mapsData.searchResults.length})</h3>
        </div>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          {#each mapsData.searchResults.slice(0, 5) as result}
            <div class="flex items-start gap-2 p-2 bg-white rounded border">
              <Icon icon="mdi:map-marker" class="w-4 h-4 text-yellow-600 mt-0.5" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">{result.name}</p>
                {#if result.address}
                  <p class="text-xs text-gray-600 truncate">{result.address}</p>
                {/if}
                <div class="flex items-center gap-2 mt-1">
                  {#if result.rating}
                    <div class="flex items-center gap-1">
                      <Icon icon="mdi:star" class="w-3 h-3 text-yellow-500" />
                      <span class="text-xs text-gray-600">{result.rating}</span>
                    </div>
                  {/if}
                  {#if result.priceLevel}
                    <span class="text-xs text-gray-600">{'$'.repeat(result.priceLevel)}</span>
                  {/if}
                  {#if result.types.length > 0}
                    <span class="text-xs text-gray-500">{result.types[0]}</span>
                  {/if}
                </div>
              </div>
              {#if result.isCurrentlySelected}
                <Icon icon="mdi:check-circle" class="w-4 h-4 text-green-600" />
              {/if}
            </div>
          {/each}
          {#if mapsData.searchResults.length > 5}
            <p class="text-xs text-gray-500 text-center">
              ... and {mapsData.searchResults.length - 5} more results
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Raw Data (for debugging) -->
    {#if showRawData}
      <details class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <summary class="cursor-pointer text-sm font-medium text-gray-700 mb-2">
          Raw Maps Data (for debugging)
        </summary>
        <pre class="text-xs text-gray-600 overflow-x-auto bg-white p-2 rounded border">
{JSON.stringify(mapsData, null, 2)}
        </pre>
      </details>
    {/if}
  </div>
{:else}
  <div class="text-center py-8 text-gray-500">
    <Icon icon="mdi:map-outline" class="w-12 h-12 mx-auto mb-2 opacity-50" />
    <p>No Maps data available</p>
    <p class="text-sm">Extract data from Google Maps to see information here</p>
  </div>
{/if}

<style>
  .maps-data-display {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style> 