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
    metadataClass = 'text-sm text-gray-500 dark:text-gray-400',
    metadataOnNewRow = false,
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
    metadataClass?: string;
    metadataOnNewRow?: boolean;
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

  // Use subtitle directly without any transformations
  const displaySubtitle = $derived(subtitle);
</script>
<div class="bg-white rounded-lg border border-gray-200 hover:border-gray-400 transition-shadow duration-200 group overflow-hidden">
  <!-- Header -->
  <div class="border-b-2 border-gray-200 group-hover:border-gray-400">
    <button 
      onclick={toggleExpanded}
      class="flex items-center justify-between w-full text-left px-2 py-2 {headerClass}"
      {disabled}
    >
      <div class="flex-1 min-w-0 {metadataOnNewRow ? 'space-y-1' : 'flex items-baseline gap-2'}">
        <div class="{metadataOnNewRow ? '' : 'flex items-baseline gap-2'}">
          <h3 class={titleClass}>{title}</h3>
          {#if displaySubtitle && !metadataOnNewRow}
            <span class={subtitleClass}>{displaySubtitle}</span>
          {/if}
          <!-- Render additional header content -->
          {#if headerExtra && !metadataOnNewRow}
            {@render headerExtra()}
          {/if}
        </div>
        
        {#if metadataOnNewRow && (displaySubtitle || headerExtra)}
          <div class="flex items-center gap-2">
            {#if displaySubtitle}
              <span class={metadataClass}>{displaySubtitle}</span>
            {/if}
            {#if headerExtra}
              {@render headerExtra()}
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- Render header actions -->
        {#if headerActions}
          {@render headerActions()}
        {/if}
        <Icon 
          icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"} 
          class="w-5 h-5 text-gray-500 flex-shrink-0"
          style="min-width: 1.25rem;"
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