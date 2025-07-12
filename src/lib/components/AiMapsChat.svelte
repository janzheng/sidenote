<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import { mapsManager } from '../ui/mapsManager.svelte';
  import { mapsChatManager } from '../ui/mapsChatManager.svelte';
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import CollapsibleContent from './ui/CollapsibleContent.svelte';
  import ApiSettings from './ui/ApiSettings.svelte';
  import type { MapsData } from '../../types/mapsData';
  import type { ChatMessage } from '../../types/chatMessage';
  import type { AgentContent } from '../agents/registry.svelte';
  
  // Import agent components
  import WeatherCard from './agent/WeatherCard.svelte';
  import SearchResults from './agent/SearchResults.svelte';
  import StatusCard from './agent/StatusCard.svelte';

  interface Props {
    url: string | null;
    content: any;
    mapsData: MapsData | null;
    isExtracting: boolean;
    onRefresh?: () => void;
  }

  let { url, content, mapsData, isExtracting, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);
  let isMapsDataExpanded = $state(false);
  let messageInput = $state('');
  let inputElement = $state<HTMLTextAreaElement>();
  let chatContainer = $state<HTMLElement>();
  let hasExtracted = $state(false);

  // Derived states
  const hasContent = $derived(url && content && content.text && content.text.length > 0);
  const hasMapsData = $derived(mapsData && Object.keys(mapsData).length > 0);
  const canExtract = $derived(url && mapsManager.isGoogleMapsUrl(url));
  const isGoogleMaps = $derived(mapsManager.isGoogleMapsUrl(url));
  const hasAgentContent = $derived(mapsChatManager.richContent && mapsChatManager.richContent.length > 0);
  const displayContent = $derived(mapsChatManager.richContent || []);

  const mapsPlaceholder = $derived(() => {
    if (isGoogleMaps) {
      return 'Ask me about maps: "find good pizza nearby", "navigate to the airport", "what\'s around here?"...';
    }
    return 'Open Google Maps first to use the Maps assistant...';
  });

  // Sync hasExtracted with actual mapsData prop to prevent re-extraction after tab switches
  $effect(() => {
    if (hasMapsData) {
      hasExtracted = true;
    } else {
      hasExtracted = false;
    }
  });

  // Auto-scroll to bottom when new content arrives
  $effect(() => {
    if (chatContainer && displayContent.length > 0) {
      requestAnimationFrame(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      });
    }
  });

  // Refocus input after operations complete
  let wasOperating = $state(false);
  $effect(() => {
    const isCurrentlyOperating = isExtracting || mapsManager.isExtracting || mapsManager.isControlling || mapsChatManager.isGenerating;
    
    // If we were operating but now we're not, refocus the input
    if (wasOperating && !isCurrentlyOperating && inputElement && isExpanded) {
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
    
    wasOperating = isCurrentlyOperating;
  });

  // Auto-extract Maps data when drawer opens for Google Maps
  async function handleToggle(expanded: boolean) {
    if (expanded && !hasMapsData && !hasExtracted && canExtract) {
      hasExtracted = true;
      isMapsDataExpanded = true; // Auto-expand maps data when extracting
      await handleExtractMapsData();
    }
    
    if (expanded && inputElement) {
      // Focus the input when drawer opens
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
  }

  // Handle Maps data extraction
  async function handleExtractMapsData() {
    if (!url || mapsManager.isExtracting) {
      return;
    }

    await mapsManager.handleExtractMapsData(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle sending Maps message
  async function handleSendMessage() {
    if (!messageInput.trim() || mapsChatManager.isGenerating) {
      return;
    }

    const message = messageInput.trim();
    messageInput = ''; // Clear input immediately

    console.log('🗺️ Sending Maps message:', message);
    
    // Use the Maps chat manager
    await mapsChatManager.handleSendMessage(url, message, () => {
      if (onRefresh) {
        onRefresh();
      }
      // Scroll to bottom after message is added
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    });
  }

  // Handle clearing chat
  async function handleClearChat() {
    if (!url || mapsChatManager.isGenerating) {
      return;
    }

    await mapsChatManager.handleClearChat(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle stopping the agent
  function handleStopAgent() {
    mapsChatManager.handleStopAgent();
  }

  // Handle clearing all (including history)
  async function handleClearAll() {
    if (!url || mapsChatManager.isGenerating) {
      return;
    }

    await mapsChatManager.handleClearAll(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle Enter key in input
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSendMessage();
    }
    // Let Enter create new lines normally
  }

  // Scroll chat to bottom
  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  // Render markdown safely
  function renderMarkdown(content: string): string {
    try {
      const result = marked.parse(content);
      return typeof result === 'string' ? result : content;
    } catch (error) {
      console.warn('Markdown rendering error:', error);
      return content;
    }
  }

  // Format Maps data for display
  function formatMapsData(data: MapsData): string {
    let formatted = `**Google Maps Data**\n\n`;
    
    if (data.currentLocation) {
      formatted += `📍 **Location:** ${data.currentLocation.lat.toFixed(6)}, ${data.currentLocation.lng.toFixed(6)}\n`;
    }
    
    if (data.searchQuery) {
      formatted += `🔍 **Search:** ${data.searchQuery}\n`;
    }
    
    formatted += `🗺️ **Map Type:** ${data.mapType}\n`;
    formatted += `🔍 **Zoom Level:** ${data.zoomLevel}\n`;
    
    if (data.searchResults && data.searchResults.length > 0) {
      formatted += `\n**Search Results (${data.searchResults.length}):**\n`;
      data.searchResults.slice(0, 5).forEach((result, index) => {
        formatted += `${index + 1}. **${result.name}**\n`;
        if (result.address) formatted += `   📍 ${result.address}\n`;
        if (result.rating) formatted += `   ⭐ ${result.rating}\n`;
      });
      if (data.searchResults.length > 5) {
        formatted += `   ... and ${data.searchResults.length - 5} more results\n`;
      }
    }
    
    if (data.currentRoute) {
      formatted += `\n**Current Route:**\n`;
      formatted += `🚗 **From:** ${data.currentRoute.origin.address}\n`;
      formatted += `🎯 **To:** ${data.currentRoute.destination.address}\n`;
      formatted += `📏 **Distance:** ${data.currentRoute.distance}\n`;
      formatted += `⏱️ **Duration:** ${data.currentRoute.duration}\n`;
    }
    
    formatted += `\n*Extracted at: ${new Date(data.extractedAt).toLocaleString()}*`;
    
    return formatted;
  }

  // Auto-resize textarea function
  function autoResizeTextarea(textarea: HTMLTextAreaElement) {
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight + padding to avoid any scrolling
    const newHeight = Math.max(40, textarea.scrollHeight + 10); // Minimum 40px + 10px padding
    textarea.style.height = newHeight + 'px';
  }

  // Handle textarea input for auto-resize
  function handleTextareaInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    autoResizeTextarea(textarea);
  }

  // Auto-resize when input content changes or textarea becomes available
  $effect(() => {
    if (inputElement) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (inputElement) {
          autoResizeTextarea(inputElement);
        }
      });
    }
  });

  // Auto-resize when drawer is opened and textarea becomes visible
  $effect(() => {
    if (isExpanded && inputElement) {
      // Small delay to ensure the drawer animation is complete
      setTimeout(() => {
        if (inputElement) {
          autoResizeTextarea(inputElement);
        }
      }, 100);
    }
  });

  // Format time for display
  const timeFormatter = new Intl.DateTimeFormat([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  function formatTime(timestamp: number): string {
    return timeFormatter.format(new Date(timestamp));
  }

  // Handle copying content
  async function handleCopyContent(content: string) {
    await navigator.clipboard.writeText(content);
  }

  // Handle copying all content as JSON
  async function handleCopyAllContent() {
    const contentJson = JSON.stringify(displayContent, null, 2);
    await navigator.clipboard.writeText(contentJson);
  }

  // Render agent content item
  function renderAgentContent(item: AgentContent): string {
    switch (item.type) {
      case 'text':
        return item.content;
      case 'thinking':
        return `💭 **Thinking:** ${item.content}`;
      case 'comment':
        return `💬 ${item.text}`;
      case 'tool_result':
        return `🔧 **Tool Result:** ${JSON.stringify(item.data, null, 2)}`;
      case 'component':
        return `🧩 **Component:** ${item.name} with props: ${JSON.stringify(item.props, null, 2)}`;
      default:
        return JSON.stringify(item);
    }
  }

  // Get content style for different types
  function getContentStyle(item: AgentContent): string {
    switch (item.type) {
      case 'thinking':
        return 'bg-blue-50 border-l-4 border-blue-400 p-3 rounded';
      case 'comment':
        return 'bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded';
      case 'tool_result':
        return 'bg-green-50 border-l-4 border-green-400 p-3 rounded';
      case 'component':
        return 'bg-purple-50 border-l-4 border-purple-400 p-3 rounded';
      default:
        return 'bg-gray-50 p-3 rounded';
    }
  }
</script>

<ToggleDrawer
  title="Maps AI Assistant"
  bind:isExpanded
  onToggle={handleToggle}
>
  {#snippet children()}
    <!-- API Configuration -->
    <ApiSettings />

    <!-- About Section -->
    <div class="py-2 text-sm text-gray-600">
      {#if isGoogleMaps}
        AI-powered Google Maps assistant with natural language control. Ask me to search, navigate, explore areas, or change map views using everyday language.
      {:else}
        Open Google Maps in another tab to use this AI assistant. I can help you search, navigate, and control the map with natural language.
      {/if}
    </div>

    <!-- Maps Data Section -->
    {#if mapsManager.extractionError}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-gray-800">Maps Data</h3>
          <div class="flex gap-2">
            <button 
              onclick={handleExtractMapsData}
              class="px-3 py-1 text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
              disabled={!canExtract || mapsManager.isExtracting}
              title={mapsManager.extractionError || 'Extract Maps Data'}
            >
              {#if mapsManager.isExtracting}
                <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
              {:else}
                <Icon icon="mdi:refresh" class="w-4 h-4" />
              {/if}
            </button>
          </div>
        </div>
        <div class="bg-red-50 border border-red-200 p-3 rounded">
          <div class="text-red-600 flex items-center gap-2">
            <Icon icon="mdi:alert-circle" class="w-5 h-5" />
            <div>
              <div class="font-medium">Maps Data Error</div>
              <div class="text-sm opacity-75">{mapsManager.extractionError}</div>
            </div>
          </div>
        </div>
      </div>
    {:else if hasMapsData}
      <CollapsibleContent
        title="Maps Data"
        content={mapsData ? formatMapsData(mapsData) : ''}
        bind:isExpanded={isMapsDataExpanded}
        onRefresh={handleExtractMapsData}
        refreshDisabled={!canExtract || mapsManager.isExtracting}
        refreshTitle={mapsManager.extractionError || 'Re-extract Maps Data'}
        showRefresh={true}
        showCopy={true}
        isLoading={mapsManager.isExtracting}
        emptyMessage="No Maps data available"
        renderAsMarkdown={true}
      />
    {:else if canExtract}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-gray-800">Maps Data</h3>
          <button 
            onclick={handleExtractMapsData}
            class="px-3 py-1 text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors text-sm flex items-center gap-1"
            disabled={mapsManager.isExtracting}
          >
            {#if mapsManager.isExtracting}
              <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
            {:else}
              <Icon icon="mdi:map" class="w-4 h-4" />
            {/if}
            Extract Maps Data
          </button>
        </div>
        <div class="bg-gray-50 border border-gray-200 p-3 rounded text-gray-600 text-sm">
          Click "Extract Maps Data" to analyze the current Google Maps view and extract location data, search results, and route information.
        </div>
      </div>
    {/if}

    <!-- AI Assistant Section -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-800">AI Assistant</h3>
        <!-- Control Buttons -->
        {#if hasAgentContent || mapsChatManager.isGenerating}
          <div class="flex gap-2">
            {#if mapsChatManager.isGenerating}
              <button 
                onclick={handleStopAgent}
                class="px-2 py-1 text-red-600 hover:text-red-700 border border-red-300 rounded transition-colors flex items-center gap-1 cursor-pointer text-sm"
                title="Stop agent"
              >
                <Icon icon="mdi:stop" class="w-4 h-4" />
                Stop
              </button>
            {/if}
            {#if hasAgentContent}
              <CopyButton 
                copyFn={handleCopyAllContent}
                buttonClass="px-2 py-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors flex items-center gap-1 cursor-pointer {mapsChatManager.isGenerating ? 'opacity-50 cursor-not-allowed' : ''}"
                iconClass="w-4 h-4"
                title="Copy all content as JSON"
              />
              <button 
                onclick={() => {
                  if (!mapsChatManager.isGenerating) handleClearChat();
                }}
                class="px-2 py-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors flex items-center gap-1 cursor-pointer {mapsChatManager.isGenerating ? 'opacity-50 cursor-not-allowed' : ''}"
                disabled={mapsChatManager.isGenerating}
                title="Clear content (keeps history)"
              >
                <Icon icon="mdi:trash-can" class="w-4 h-4" />
              </button>
              <button 
                onclick={() => {
                  if (!mapsChatManager.isGenerating) handleClearAll();
                }}
                class="px-2 py-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors flex items-center gap-1 cursor-pointer {mapsChatManager.isGenerating ? 'opacity-50 cursor-not-allowed' : ''}"
                disabled={mapsChatManager.isGenerating}
                title="Clear everything (including history)"
              >
                <Icon icon="mdi:delete-forever" class="w-4 h-4" />
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Chat Error -->
      {#if mapsChatManager.chatError}
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <div class="text-red-600 flex items-center gap-2">
            <Icon icon="mdi:alert-circle" class="w-5 h-5" />
            <div>
              <div class="font-medium">Assistant Error</div>
              <div class="text-sm opacity-75">{mapsChatManager.chatError}</div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Chat Status -->
      {#if mapsChatManager.isGenerating}
        <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div class="text-blue-600 flex items-center gap-2">
            <Icon icon="mdi:loading" class="animate-spin w-5 h-5" />
            <div>
              <div class="font-medium">Assistant Working</div>
              <div class="text-sm opacity-75">Processing your Maps request...</div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Agent Content Display -->
      {#if displayContent.length === 0}
        <div class="bg-gray-50 border border-gray-200 p-3 rounded text-gray-600 text-sm mb-4">
          No agent activity yet. Send a message to start the Maps AI assistant.
        </div>
      {:else}
        <div 
          bind:this={chatContainer}
          class="overflow-y-auto mb-4 max-h-96 space-y-3"
        >
          {#each displayContent as item, index (index)}
            <div class="group">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-gray-400 ml-auto text-xs">
                  {formatTime(Date.now())}
                </span>
                <CopyButton 
                  copyFn={() => handleCopyContent(renderAgentContent(item))}
                  buttonClass="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                  iconClass="w-4 h-4 text-gray-400 hover:text-gray-600"
                  title="Copy content"
                />
              </div>
              
              {#if item.type === 'component'}
                <!-- Render actual Svelte components -->
                <div class="mb-2">
                  {#if item.name === 'WeatherCard'}
                    <WeatherCard 
                      location={item.props.location}
                      temp_c={item.props.temp_c}
                      condition={item.props.condition}
                      ts={item.props.ts}
                    />
                  {:else if item.name === 'SearchResults'}
                    <SearchResults 
                      query={item.props.query}
                      results={item.props.results}
                      count={item.props.count}
                    />
                  {:else if item.name === 'StatusCard'}
                    <StatusCard 
                      status={item.props.status}
                      message={item.props.message}
                      details={item.props.details}
                    />
                  {:else}
                    <!-- Fallback for unknown components -->
                    <div class={getContentStyle(item)}>
                      <div class="text-gray-900 break-words prose prose-sm max-w-none markdown-content">
                        {@html renderMarkdown(renderAgentContent(item))}
                      </div>
                    </div>
                  {/if}
                </div>
              {:else}
                <!-- Render other content types -->
                <div class={getContentStyle(item)}>
                  <div class="text-gray-900 break-words prose prose-sm max-w-none markdown-content">
                    {@html renderMarkdown(renderAgentContent(item))}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Message Input -->
      <div>
        <textarea
          bind:this={inputElement}
          bind:value={messageInput}
          onkeydown={handleKeydown}
          oninput={handleTextareaInput}
          placeholder={mapsPlaceholder()}
          class="w-full px-3 py-2 border border-gray-300 rounded-md resize-none bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          style="min-height: 40px;"
          disabled={mapsChatManager.isGenerating || !isGoogleMaps}
        ></textarea>
        <div class="flex justify-between items-center mt-2">
          <div class="text-xs text-gray-500">
            {#if isGoogleMaps}
              Try: "find good sushi nearby", "navigate to the airport", "what's around here", "zoom to satellite view"
            {:else}
              Open Google Maps in another tab to use the assistant
            {/if}
          </div>
          <button 
            onclick={handleSendMessage}
            class="bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-500 disabled:bg-gray-100 px-2 py-1"
            disabled={mapsChatManager.isGenerating || !messageInput.trim() || !isGoogleMaps}
          >
            {#if mapsChatManager.isGenerating}
              <Icon icon="mdi:loading" class="animate-spin w-4 h-4" />
            {:else}
              <Icon icon="mdi:arrow-top-right-bold-box" class="w-4 h-4"/>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/snippet}
</ToggleDrawer>

<style>
  .markdown-content :global(ul) {
    list-style-type: disc;
    margin-left: 2rem;
    padding-left: 0.5rem;
    margin-bottom: 1rem;
  }

  .markdown-content :global(ol) {
    list-style-type: decimal;
    margin-left: 2rem;
    padding-left: 0.5rem;
    margin-bottom: 1rem;
  }

  .markdown-content :global(li) {
    margin-bottom: 0.25rem;
    padding-left: 0.5rem;
  }

  .markdown-content :global(p) {
    margin-bottom: 0.75rem;
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4),
  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    font-weight: 600;
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }

  .markdown-content :global(h1) { font-size: 1.25rem; }
  .markdown-content :global(h2) { font-size: 1.125rem; }
  .markdown-content :global(h3) { font-size: 1rem; }

  .markdown-content :global(code) {
    background-color: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .markdown-content :global(pre) {
    background-color: #f3f4f6;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }
</style> 