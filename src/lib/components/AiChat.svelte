<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import { chatManager } from '../ui/chatManager.svelte';
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import type { ChatMessage } from '../../types/chatMessage';

  interface Props {
    url: string | null;
    content: any;
    chatMessages: ChatMessage[] | null;
    isGenerating: boolean;
    onRefresh?: () => void;
  }

  let { url, content, chatMessages, isGenerating, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);
  let messageInput = $state('');
  let chatContainer: HTMLElement;
  let inputElement: HTMLTextAreaElement;

  // Derived states
  const hasContent = $derived(url && content && content.text && content.text.length > 0);
  const hasMessages = $derived(chatMessages && chatMessages.length > 0);
  const displayMessages = $derived(chatMessages || []);

  const chatPlaceholder = $derived(() => {
    if (content?.title) {
      return `Ask about "${content.title.slice(0, 50)}${content.title.length > 50 ? '...' : ''}"`;
    }
    if (content?.url) {
      const hostname = new URL(content.url).hostname.replace('www.', '');
      return `Ask about this ${hostname} page...`;
    }
    return 'Ask about this page...';
  });

  // Sync chat manager with prop messages when they change
  $effect(() => {
    if (chatMessages) {
      chatManager.setMessages(chatMessages);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  $effect(() => {
    if (chatContainer && displayMessages.length > 0) {
      requestAnimationFrame(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      });
    }
  });

  // Refocus input after response completes
  let wasGenerating = $state(false);
  $effect(() => {
    const isCurrentlyGenerating = isGenerating || chatManager.isGenerating;
    
    // If we were generating but now we're not, refocus the input
    if (wasGenerating && !isCurrentlyGenerating && inputElement && isExpanded) {
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
    
    wasGenerating = isCurrentlyGenerating;
  });

  // Handle sending message
  async function handleSendMessage() {
    if (!messageInput.trim() || !url || chatManager.isGenerating) {
      return;
    }

    const message = messageInput.trim();
    messageInput = ''; // Clear input immediately

    await chatManager.handleSendMessage(url, message, () => {
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
    if (!url || chatManager.isGenerating) {
      return;
    }

    await chatManager.handleClearChat(url, () => {
      if (onRefresh) {
        onRefresh();
      }
    });
  }

  // Handle Enter key in input
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
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

  // Format time for display
  const timeFormatter = new Intl.DateTimeFormat([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  function formatTime(timestamp: number): string {
    return timeFormatter.format(new Date(timestamp));
  }

  // Handle copying message content
  async function handleCopyMessage(content: string) {
    await navigator.clipboard.writeText(content);
  }

  // Handle copying all messages as JSON
  async function handleCopyAllMessages() {
    const messagesJson = JSON.stringify(displayMessages, null, 2);
    await navigator.clipboard.writeText(messagesJson);
  }

  function handleToggle(isExpanded: boolean) {
    if (isExpanded && inputElement) {
      // Focus the input when drawer opens
      inputElement.focus();
    }
  }
</script>

  <ToggleDrawer
    title="AI Chat"
    bind:isExpanded
    onToggle={handleToggle}
  >
  {#snippet children()}
    <!-- Clear and Copy All Buttons -->
    {#if hasMessages}
      <div class="flex justify-end gap-2 mb-2">
        <CopyButton 
          copyFn={handleCopyAllMessages}
          buttonClass="px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 cursor-pointer {isGenerating || chatManager.isGenerating ? 'opacity-50 cursor-not-allowed' : ''}"
          iconClass="w-6 h-6"
          title="Copy all messages as JSON"
        />
        <button 
          onclick={() => {
            if (!isGenerating && !chatManager.isGenerating) handleClearChat();
          }}
          class="px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 cursor-pointer {isGenerating || chatManager.isGenerating ? 'opacity-50 cursor-not-allowed' : ''}"
          disabled={isGenerating || chatManager.isGenerating}
        >
          <Icon icon="mdi:trash-can" class="w-6 h-6" />
        </button>
      </div>
    {/if}

    <!-- Chat Messages -->
    {#if chatManager.chatError}
      <div class="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border-l-2 border-red-600 rounded">
        <div class="text-red-600 dark:text-red-400 text-sm">
          <Icon icon="mdi:alert-circle" class="inline mr-1" />
          Error: {chatManager.chatError}
        </div>
      </div>
    {/if}

    {#if displayMessages.length === 0}
      <div class="text-gray-500 italic">
        {#if hasContent}
          Ready to answer questions about this page content
        {:else}
          No page content available - navigate to a page with content to start chatting
        {/if}
      </div>
    {:else}
      <div 
        bind:this={chatContainer}
        class="overflow-y-auto max-h-[400px]"
      >
        <div class="space-y-2">
                     {#each displayMessages as message, index (index)}
             {#if message.role !== 'system'}
               <div class="flex flex-col w-full group">
                 <div class="flex items-center gap-2 mb-1">
                   <span class="text-gray-400 ml-auto text-xs">
                     {formatTime(Date.now())}
                   </span>
                  <CopyButton 
                    copyFn={() => handleCopyMessage(message.content)}
                    buttonClass="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                    iconClass="w-4 h-4 text-gray-400 hover:text-gray-600"
                    title="Copy message"
                  />
                </div>
                {#if message.role === 'user'}
                  <!-- User messages in gray bubble -->
                  <div class="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-600">
                    <div class="text-gray-700 dark:text-gray-300 break-words">
                      <pre class="font-sans whitespace-pre-wrap leading-relaxed">{message.content}</pre>
                    </div>
                  </div>
                {:else}
                  <!-- AI messages as markdown -->
                  <div class="w-full">
                    <div class="text-gray-900 dark:text-gray-300 break-words prose prose-sm max-w-none markdown-content">
                      {@html renderMarkdown(message.content)}
                      {#if isGenerating || chatManager.isGenerating}
                        <span class="inline-block w-2 h-4 bg-green-600 animate-pulse ml-1"></span>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Chat Input -->
    <div class="flex gap-2 mt-4">
      <textarea
        bind:this={inputElement}
        bind:value={messageInput}
        onkeydown={handleKeydown}
                 placeholder={chatPlaceholder()}
         class="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded resize-none bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        rows="1"
        disabled={isGenerating || chatManager.isGenerating || !hasContent}
      ></textarea>
      <button 
        onclick={handleSendMessage}
        class="bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 dark:border-gray-600 text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-500 disabled:bg-gray-100 px-2 py-1"
        disabled={isGenerating || chatManager.isGenerating || !messageInput.trim() || !hasContent}
      >
        {#if isGenerating || chatManager.isGenerating}
          <Icon icon="mdi:loading" class="animate-spin w-6 h-6" />
        {:else}
          <Icon icon="mdi:arrow-top-right-bold-box" class="w-6 h-6"/>
        {/if}
      </button>
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

  .markdown-content :global(ul ul),
  .markdown-content :global(ol ol),
  .markdown-content :global(ul ol),
  .markdown-content :global(ol ul) {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .markdown-content :global(ul ul) {
    list-style-type: circle;
  }

  .markdown-content :global(ul ul ul) {
    list-style-type: square;
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