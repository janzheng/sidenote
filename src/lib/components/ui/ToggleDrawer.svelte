<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from 'svelte';

  // Props using Svelte 5 runes and snippets
  let {
    title,
    subtitle = '',
    isExpanded = $bindable(false),
    disabled = false,
    headerClass = '',
    contentClass = '',
    titleClass = 'text-md font-bold text-gray-700 dark:text-gray-300',
    subtitleClass = 'text-sm text-gray-500 dark:text-gray-400',
    onToggle,
    children,
    headerExtra,
    headerActions
  }: {
    title: string;
    subtitle?: string;
    isExpanded?: boolean;
    disabled?: boolean;
    headerClass?: string;
    contentClass?: string;
    titleClass?: string;
    subtitleClass?: string;
    onToggle?: (isExpanded: boolean) => void;
    children?: Snippet;
    headerExtra?: Snippet;
    headerActions?: Snippet;
  } = $props();

  function toggleExpanded() {
    if (!disabled) {
      isExpanded = !isExpanded;
      
      // Call the callback if provided, with a small delay to allow DOM to update
      if (onToggle) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          onToggle?.(isExpanded);
        });
      }
    }
  }
</script>
<div class="bg-white rounded-lg border border-gray-200 hover:border-gray-400 transition-shadow duration-200 group overflow-hidden">
  <!-- Header -->
  <div class="border-b-2 border-gray-200 group-hover:border-gray-400">
    <button 
      onclick={toggleExpanded}
      class="flex items-center justify-between w-full text-left px-2 py-2 {headerClass}"
      {disabled}
    >
      <div class="flex items-baseline gap-2">
        <h3 class={titleClass}>{title}</h3>
        {#if subtitle}
          <span class={subtitleClass}>{subtitle}</span>
        {/if}
        <!-- Render additional header content -->
        {#if headerExtra}
          {@render headerExtra()}
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <!-- Render header actions -->
        {#if headerActions}
          {@render headerActions()}
        {/if}
        <Icon 
          icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"} 
          class="w-5 h-5 text-gray-500"
        />
      </div>
    </button>
  </div>

  <!-- Content -->
  {#if isExpanded}
    <div class="p-4 space-y-4 {contentClass}">
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}
</div> 