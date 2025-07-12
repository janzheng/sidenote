<script lang="ts">
  interface Props {
    status: 'success' | 'error' | 'warning' | 'info';
    message: string;
    details?: string;
  }

  let { status, message, details }: Props = $props();

  // Get status styling
  function getStatusStyle(status: string) {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  }

  // Get status icon
  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  }

  // Get status label
  function getStatusLabel(status: string) {
    switch (status) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
      default:
        return 'Info';
    }
  }
</script>

<div class="border rounded-lg p-4 {getStatusStyle(status)}">
  <div class="flex items-start gap-3">
    <span class="text-2xl">{getStatusIcon(status)}</span>
    <div class="flex-1">
      <div class="font-semibold mb-1">
        {getStatusLabel(status)}
      </div>
      <div class="mb-2">
        {message}
      </div>
      {#if details}
        <div class="text-sm opacity-75">
          {details}
        </div>
      {/if}
    </div>
  </div>
</div> 