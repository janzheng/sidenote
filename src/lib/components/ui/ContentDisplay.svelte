<script lang="ts">
  import CopyButton from './CopyButton.svelte';
  import Icon from "@iconify/svelte";

  interface Props {
    title: string;
    content: string;
    copyTitle?: string;
    headerClass?: string;
    contentClass?: string;
    containerClass?: string;
    // Optional download button props
    downloadButton?: {
      text: string;
      filename: string;
      icon?: string;
      onclick: () => void;
    };
  }

  let { 
    title, 
    content, 
    copyTitle = `Copy ${title}`,
    headerClass = "p-3 border-b bg-gray-100 rounded-t-lg",
    contentClass = "p-3",
    containerClass = "bg-gray-50 border rounded-lg",
    downloadButton
  }: Props = $props();
</script>

<div class={containerClass}>
  <!-- Header -->
  <div class="flex items-center justify-between {headerClass}">
    <h4 class="font-semibold text-gray-900">{title}</h4>
    <div class="flex items-center gap-2">
      {#if downloadButton}
        <button 
          onclick={downloadButton.onclick}
          class="p-2 hover:bg-gray-200 rounded transition-colors text-green-600"
          title="Download {downloadButton.filename}"
        >
          <Icon icon={downloadButton.icon || "mdi:download"} class="w-4 h-4" />
        </button>
      {/if}
      <CopyButton 
        content={content}
        title={copyTitle}
        buttonClass="p-2 hover:bg-gray-200 rounded transition-colors"
        iconClass="w-4 h-4"
        defaultIcon="mdi:content-copy"
        successIcon="mdi:check"
      />
    </div>
  </div>
  
  <!-- Content -->
  <div class={contentClass}>
    <pre class="text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{content}</pre>
  </div>
</div>

<style>
  pre {
    word-break: break-word;
    white-space: pre-wrap;
  }
</style> 