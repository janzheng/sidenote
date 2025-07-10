<script lang="ts">
  import CopyButton from './CopyButton.svelte';

  interface Props {
    title: string;
    content: string;
    copyTitle?: string;
    headerClass?: string;
    contentClass?: string;
    containerClass?: string;
  }

  let { 
    title, 
    content, 
    copyTitle = `Copy ${title}`,
    headerClass = "p-3 border-b bg-gray-100 rounded-t-lg",
    contentClass = "p-3",
    containerClass = "bg-gray-50 border rounded-lg"
  }: Props = $props();
</script>

<div class={containerClass}>
  <!-- Header -->
  <div class="flex items-center justify-between {headerClass}">
    <h4 class="font-semibold text-gray-900">{title}</h4>
    <CopyButton 
      content={content}
      title={copyTitle}
      buttonClass="p-2 hover:bg-gray-200 rounded transition-colors"
      iconClass="w-4 h-4"
      defaultIcon="mdi:content-copy"
      successIcon="mdi:check"
    />
  </div>
  
  <!-- Content -->
  <div class={contentClass}>
    <pre class="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{content}</pre>
  </div>
</div>

<style>
  pre {
    word-break: break-word;
    white-space: pre-wrap;
  }
</style> 