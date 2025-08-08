<script lang="ts">
  import { settingsManager } from '../../ui/settings.svelte';
  import Icon from "@iconify/svelte";

  interface Props {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    showOffHint?: boolean;
    offHintText?: string;
  }

  let { size = 'md', showText = true, showOffHint = false, offHintText = 'sidebar will not refresh' }: Props = $props();

  const toggleAutoRefresh = () => {
    settingsManager.updateSetting('autoRefresh', !settingsManager.settings.autoRefresh);
  };

  // Size variants
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-md', 
    lg: 'px-6 py-3 text-lg'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
</script>

<button 
  onclick={toggleAutoRefresh}
  class="rounded border transition-colors duration-200 flex items-center gap-2 font-medium {sizeClasses[size]}
         {settingsManager.settings.autoRefresh ? 
           'bg-green-600 border-green-600 text-white hover:bg-green-700' :
           'bg-gray-300 border-gray-300 text-gray-700 hover:bg-gray-400 hover:text-gray-800'}"
  title={settingsManager.settings.autoRefresh ? 
         "AutoRefresh is ON - Click to disable automatic page refresh when switching tabs" :
         "AutoRefresh is OFF - Click to enable automatic page refresh when switching tabs"}
>
  <Icon 
    icon={settingsManager.settings.autoRefresh ? "mdi:lock-open" : "mdi:lock"} 
    class={iconSizes[size]}
  />
  {#if showText}
    <span class="leading-none">
      AutoRefresh {settingsManager.settings.autoRefresh ? 'ON' : 'OFF'}
    </span>
  {/if}
</button>
{#if showOffHint && !settingsManager.settings.autoRefresh}
  <span class="ml-2 text-xs italic text-gray-600">
    {offHintText}
  </span>
{/if}