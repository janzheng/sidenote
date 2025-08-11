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

  // Configure marked: sanitize links and render with GFM + soft breaks
  function tryExtractUrlFromJson(input: string): string | null {
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed.url === 'string') return parsed.url;
      if (parsed && typeof parsed.href === 'string') return parsed.href;
      return null;
    } catch {
      return null;
    }
  }

  function coerceHrefToString(href: unknown): string | null {
    if (typeof href === 'string') return href;
    if (href && typeof href === 'object') {
      try {
        const maybeHref = (href as any).href ?? String(href);
        if (typeof maybeHref === 'string') return maybeHref;
      } catch {}
    }
    return null;
  }

  function sanitizeQuery(raw: string): string {
    let s = (raw || '').trim();
    if (!s) return s;
    try {
      const plusDecoded = s.replace(/\+/g, ' ');
      s = decodeURIComponent(plusDecoded);
    } catch {}
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function normalizeLinkHref(href: unknown, text: string): string {
    let url = coerceHrefToString(href)?.trim() || '';
    if (!url || url === '[object Object]') {
      const q = sanitizeQuery(text || '');
      return q ? `https://www.google.com/maps/search/${encodeURIComponent(q).replace(/%20/g, '+')}` : '#';
    }
    if (url.startsWith('{') || url.startsWith('[')) {
      const extracted = tryExtractUrlFromJson(url);
      if (extracted) url = extracted.trim();
    }
    if (!/^https?:\/\//i.test(url) || url.startsWith('chrome-extension://')) {
      const q = sanitizeQuery(text || '');
      return q ? buildMapsSearchUrl(q) : '#';
    }
    // For standard http(s) links, return as-is to avoid accidental double-encoding
    return url;
  }


  function buildMapsSearchUrl(q: string): string {
    const encoded = encodeURIComponent(q).replace(/%20/g, '+');
    // ReAct agent doesn't have mapsData; use plain search URL
    return `https://www.google.com/maps/search/${encoded}`;
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  const linkRenderer = {
    link(href: unknown, title: unknown, text: string) {
      const finalHref = normalizeLinkHref(href, text);
      const titleAttr = typeof title === 'string' && title ? ` title="${title}"` : '';
      const hasValidText = typeof text === 'string' && !!text.trim() && text.trim().toLowerCase() !== 'undefined';
      let label: string | null = hasValidText ? text : null;
      if (!label && typeof finalHref === 'string' && finalHref !== '#') {
        const derived = (() => {
          try {
            const u = new URL(finalHref, 'https://www.google.com');
            const m = u.pathname.match(/\/maps\/search\/(.+)$/);
            if (m && m[1]) {
              const raw = m[1].split('?')[0];
              return decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
            }
            const q = u.searchParams.get('q');
            if (q) return decodeURIComponent(q.replace(/\+/g, ' ')).trim();
          } catch {}
          return null;
        })();
        if (derived) label = derived;
      }
      if (!label) label = 'Open in Google Maps';
      if (finalHref === '#') {
        const safeLabel = escapeHtml(label);
        return `<a href="#"${titleAttr}>${safeLabel}</a>`;
      }
      // Add data attribute so we can optionally delegate navigation
      return `<a href="${finalHref}" data-navigate="maps"${titleAttr}>${escapeHtml(label)}</a>`;
    }
  } as any;
  marked.use({ renderer: linkRenderer });
  marked.use({ gfm: true, breaks: true });

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

  function extractCandidateName(li: HTMLElement, anchor: HTMLAnchorElement): string | null {
    try {
      const parts: string[] = [];
      li.childNodes.forEach((node) => {
        if (node === anchor) return;
        if (node.nodeType === Node.TEXT_NODE) {
          parts.push((node.textContent || '').trim());
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          parts.push(((node as Element).textContent || '').trim());
        }
      });
      const combined = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (!combined) return null;
      const name = combined.split(/\s[—–-]\s|[—–-]/)[0]?.trim();
      if (!name || name.toLowerCase() === 'undefined' || name.length < 2) return null;
      return name;
    } catch {
      return null;
    }
  }

  function repairInvalidLinks(root: HTMLElement | undefined) {
    if (!root) return;
    const anchors = root.querySelectorAll<HTMLAnchorElement>('.aiReActAgent a');
    anchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const label = (a.textContent || '').trim();
      // Decode percent-encoded labels for readability
      if (/%[0-9a-fA-F]{2}/.test(label)) {
        const cleaned = sanitizeQuery(label);
        if (cleaned && cleaned !== label) {
          a.textContent = cleaned;
        }
      }
      const needsRepair = !href || href === '#' || href.startsWith('chrome-extension://') || !/^https?:\/\//i.test(href) || label.toLowerCase() === 'undefined' || label === '' || label === 'Open in Google Maps';
      if (!needsRepair) return;
      const li = a.closest('li') as HTMLElement | null;
      const candidate = li ? extractCandidateName(li, a) : null;
      if (candidate) {
        a.textContent = candidate;
        a.setAttribute('href', buildMapsSearchUrl(candidate));
        a.setAttribute('data-navigate', 'maps');
        return;
      }
      // Attempt to repair malformed Google Maps links that are double-encoded
      try {
        const u = new URL(href, 'https://www.google.com');
        const isGmaps = /(^|\.)google\.(com|[a-z\.]+)$/i.test(u.hostname) && u.pathname.startsWith('/maps');
        if (isGmaps) {
          let q: string | null = null;
          const m = u.pathname.match(/\/maps\/search\/(.+)$/);
          if (m && m[1]) {
            let raw = m[1].split('/@')[0].split('?')[0];
            try { raw = decodeURIComponent(raw); } catch {}
            try { raw = decodeURIComponent(raw); } catch {}
            q = sanitizeQuery(raw.replace(/\+/g, ' '));
          }
          if (!q) {
            const qp = u.searchParams.get('q');
            if (qp) {
              let raw = qp;
              try { raw = decodeURIComponent(raw); } catch {}
              try { raw = decodeURIComponent(raw); } catch {}
              q = sanitizeQuery(raw.replace(/\+/g, ' '));
            }
          }
          if (!q && label) q = sanitizeQuery(label);
          if (q) {
            a.setAttribute('href', buildMapsSearchUrl(q));
            a.setAttribute('data-navigate', 'maps');
          }
        }
      } catch {}
    });
  }

  $effect(() => {
    if (!contentContainer || displayContent.length === 0) return;
    setTimeout(() => repairInvalidLinks(contentContainer), 0);
  });

  // Intercept in-panel map links to navigate the active tab
  $effect(() => {
    if (!contentContainer) return;
    const handleLinkClick = (event: MouseEvent) => {
      const targetEl = event.target as HTMLElement | null;
      const anchor = targetEl?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) return;
      const wantsMapsNav = anchor.getAttribute('data-navigate') === 'maps' || href.includes('/maps/search/') || href.includes('/maps/dir/');
      if (!wantsMapsNav) return;
      event.preventDefault();
      chrome.runtime.sendMessage({ action: 'navigateToUrl', url: href }, () => {});
    };
    contentContainer.addEventListener('click', handleLinkClick);
    return () => contentContainer?.removeEventListener('click', handleLinkClick);
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
      console.log('🔍 [aiReActAgent] renderMarkdown raw content:', content);
      const result = marked.parse(content);
      console.log('🔍 [aiReActAgent] renderMarkdown result:', result);
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
                         <div class="aiReActAgent text-gray-900 break-words prose prose-sm max-w-none markdown-content">
                           {@html renderMarkdown(renderAgentContent(item))}
                         </div>
                       </div>
                     {/if}
                   </div>
                 {:else}
                 <!-- Render other content types as before -->
                 <div class={getContentStyle(item)}>
                   <div class="aiReActAgent text-gray-900 break-words prose prose-sm max-w-none markdown-content">
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