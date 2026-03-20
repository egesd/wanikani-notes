<script lang="ts">
  let {
    message,
    type = 'info',
  }: {
    message: string;
    type?: 'success' | 'error' | 'info';
  } = $props();

  const icons: Record<string, string> = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
  };

  const colors: Record<string, string> = {
    success: 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/50',
    error: 'text-error bg-error-container dark:text-red-400 dark:bg-red-950/50',
    info: 'text-secondary bg-secondary-fixed dark:text-blue-400 dark:bg-blue-950/50',
  };
</script>

{#if message}
  <div class="flex items-start gap-3 p-4 rounded-xl {colors[type]}" role={type === 'error' ? 'alert' : 'status'}>
    <span class="material-symbols-outlined text-xl mt-0.5">{icons[type]}</span>
    <p class="font-body text-sm leading-relaxed">{message}</p>
  </div>
{/if}
