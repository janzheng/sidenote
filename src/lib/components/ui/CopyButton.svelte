<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from 'svelte';
  
  interface Props {
    content?: string;
    copyFn?: () => Promise<void> | void;
    successIcon?: string;
    defaultIcon?: string;
    buttonClass?: string;
    iconClass?: string;
    title?: string;
    successDuration?: number;
    onSuccess?: (success: boolean) => void;
    children?: Snippet;
  }
  
  const { 
    content = "",
    copyFn = undefined,
    successIcon = "mdi:check",
    defaultIcon = "mdi:content-copy",
    buttonClass = "p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors",
    iconClass = "w-4 h-4",
    title = "Copy to clipboard",
    successDuration = 2000,
    onSuccess = undefined,
    children
  }: Props = $props();
  
  let copySuccess = $state(false);
  
  async function handleCopy() {
    try {
      if (copyFn) {
        await copyFn();
      } else if (content) {
        await navigator.clipboard.writeText(content);
      } else {
        console.warn('CopyButton: No content or copyFn provided');
        return;
      }
      
      copySuccess = true;
      onSuccess?.(true);
      setTimeout(() => {
        copySuccess = false;
        onSuccess?.(false);
      }, successDuration);
    } catch (err) {
      console.error('Failed to copy content: ', err);
    }
  }
</script>

<button
  onclick={handleCopy}
  class={buttonClass}
  {title}
>
  {#if copySuccess}
    <Icon icon={successIcon} class="{iconClass} text-green-600" />
  {:else}
    <Icon icon={defaultIcon} class={iconClass} />
  {/if}
  {#if children}
    {@render children()}
  {/if}
</button> 