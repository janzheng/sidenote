<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import { reactAgentManager } from '../ui/reactAgentManager.svelte';
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import ApiSettings from './ui/ApiSettings.svelte';
  import type { AgentContent } from '../agents/registry.svelte';
  
  // Import agent components
  import WeatherCard from './agent/WeatherCard.svelte';
  import SearchResults from './agent/SearchResults.svelte';
  import StatusCard from './agent/StatusCard.svelte';

  interface Props {
    url: string | null;
    content: any;
    onRefresh?: () => void;
  }

  let { url, content, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);
  let messageInput = $state('');
  let inputElement = $state<HTMLTextAreaElement>();
  let contentContainer = $state<HTMLElement>();

  // Derived states
  const hasContent = $derived(url && content && content.text && content.text.length > 0);
  const hasAgentContent = $derived(reactAgentManager.content && reactAgentManager.content.length > 0);
  const displayContent = $derived(reactAgentManager.content || []);

  const agentPlaceholder = $derived(() => {
    if (content?.title) {
      return `Ask the ReAct agent about "${content.title.slice(0, 50)}${content.title.length > 50 ? '...' : ''}"`;
    }
    if (content?.url) {
      const hostname = new URL(content.url).hostname.replace('www.', '');
      return `Ask the ReAct agent about this ${hostname} page...`;
    }
    return 'Ask the ReAct agent to help you with tools and reasoning...';
  });

  // Auto-scroll to bottom when new content arrives
  $effect(() => {
    if (contentContainer && displayContent.length > 0) {
      requestAnimationFrame(() => {
        if (contentContainer) {
          contentContainer.scrollTop = contentContainer.scrollHeight;
        }
      });
    }
  });

  // Refocus input after operations complete
  let wasRunning = $state(false);
  $effect(() => {
    const isCurrentlyRunning = reactAgentManager.isRunning;
    
    // If we were running but now we're not, refocus the input
    if (wasRunning && !isCurrentlyRunning && inputElement && isExpanded) {
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
    
    wasRunning = isCurrentlyRunning;
  });

  // Handle sending message to ReAct agent
  async function handleSendMessage() {
    if (!messageInput.trim() || reactAgentManager.isRunning) {
      return;
    }

    const message = messageInput.trim();
    messageInput = ''; // Clear input immediately

    console.log('🤖 Sending message to ReAct agent:', message);
    
    // Get page content for context
    const pageContent = content?.text ? content.text.slice(0, 5000) : undefined;
    
    await reactAgentManager.handleRunAgent(message, pageContent, () => {
      if (onRefresh) {
        onRefresh();
      }
      // Scroll to bottom after content is added
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    });
  }

  // Handle stopping the agent
  function handleStopAgent() {
    reactAgentManager.handleStopAgent();
  }

  // Handle clearing agent content
  async function handleClearAgent() {
    if (reactAgentManager.isRunning) {
      return;
    }

    await reactAgentManager.handleClearAgent(() => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle clearing everything including history
  async function handleClearAll() {
    if (reactAgentManager.isRunning) {
      return;
    }

    await reactAgentManager.handleClearAll(() => {
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

  // Scroll content to bottom
  function scrollToBottom() {
    if (contentContainer) {
      contentContainer.scrollTop = contentContainer.scrollHeight;
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

  // Handle toggle drawer
  function handleToggle(expanded: boolean) {
    if (expanded && inputElement) {
      // Focus the input when drawer opens
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
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
  title="ReAct Agent (Beta)"
  bind:isExpanded
  onToggle={handleToggle}
>
  {#snippet children()}
    <!-- API Configuration -->
    <ApiSettings />

    <!-- About Section -->
    <div class="py-2 text-sm text-gray-600">
      AI agent that can reason step-by-step and use tools to solve complex tasks. This is a prototype implementation of the ReAct (Reasoning and Acting) pattern.
    </div>

    <!-- Agent Status -->
    {#if reactAgentManager.isRunning}
      <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <div class="text-blue-600 flex items-center gap-2">
          <Icon icon="mdi:loading" class="animate-spin w-5 h-5" />
          <div>
            <div class="font-medium">Agent Running</div>
            <div class="text-sm opacity-75">Thinking and executing tools...</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Agent Error -->
    {#if reactAgentManager.error}
      <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">Agent Error</div>
            <div class="text-sm opacity-75">{reactAgentManager.error}</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Agent Content -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-800">Agent Activity</h3>
        <!-- Control Buttons -->
        {#if hasAgentContent || reactAgentManager.isRunning}
          <div class="flex gap-2">
            {#if reactAgentManager.isRunning}
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
                buttonClass="px-2 py-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors flex items-center gap-1 cursor-pointer {reactAgentManager.isRunning ? 'opacity-50 cursor-not-allowed' : ''}"
                iconClass="w-4 h-4"
                title="Copy all content as JSON"
              />
              <button 
                onclick={() => {
                  if (!reactAgentManager.isRunning) handleClearAgent();
                }}
                class="px-2 py-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors flex items-center gap-1 cursor-pointer {reactAgentManager.isRunning ? 'opacity-50 cursor-not-allowed' : ''}"
                disabled={reactAgentManager.isRunning}
                title="Clear content (keeps history)"
              >
                <Icon icon="mdi:trash-can" class="w-4 h-4" />
              </button>
              <button 
                onclick={() => {
                  if (!reactAgentManager.isRunning) handleClearAll();
                }}
                class="px-2 py-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors flex items-center gap-1 cursor-pointer {reactAgentManager.isRunning ? 'opacity-50 cursor-not-allowed' : ''}"
                disabled={reactAgentManager.isRunning}
                title="Clear everything (including history)"
              >
                <Icon icon="mdi:delete-forever" class="w-4 h-4" />
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Agent Content Display -->
      {#if displayContent.length === 0}
        <div class="bg-gray-50 border border-gray-200 p-3 rounded text-gray-600 text-sm mb-2">
          No agent activity yet. Send a message to start the ReAct agent.
        </div>
      {:else}
        <div 
          bind:this={contentContainer}
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
                 <!-- Render other content types as before -->
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

      <!-- Agent Input -->
      <div>
        <textarea
          bind:this={inputElement}
          bind:value={messageInput}
          onkeydown={handleKeydown}
          oninput={handleTextareaInput}
          placeholder={agentPlaceholder()}
          class="w-full px-3 py-2 border border-gray-300 rounded-md resize-none bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          style="min-height: 40px;"
          disabled={reactAgentManager.isRunning}
        ></textarea>
        <div class="flex justify-between items-center mt-2">
          <div class="text-xs text-gray-500">
            Try: "Get weather for San Francisco", "Search for React tutorials", "Analyze this page content"
          </div>
          <button 
            onclick={handleSendMessage}
            class="bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-500 disabled:bg-gray-100 px-2 py-1"
            disabled={reactAgentManager.isRunning || !messageInput.trim()}
          >
            {#if reactAgentManager.isRunning}
              <Icon icon="mdi:loading" class="animate-spin w-6 h-6" />
            {:else}
              <Icon icon="mdi:arrow-top-right-bold-box" class="w-6 h-6"/>
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