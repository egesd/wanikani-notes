<script lang="ts">
  let {
    message,
    type = 'info',
  }: {
    message: string;
    type?: 'success' | 'error' | 'info';
  } = $props();
</script>

{#if message}
  <div class="status-message {type}" role={type === 'error' ? 'alert' : 'status'}>
    {message}
  </div>
{/if}

<style>
  .status-message {
    padding: 0.6rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .success {
    background: #e6f9ed;
    color: #146b2e;
    border: 1px solid #b6e8c8;
  }
  .error {
    background: #fde8e8;
    color: #9b1c1c;
    border: 1px solid #f8b4b4;
  }
  .info {
    background: #e8f0fe;
    color: #1a56db;
    border: 1px solid #b4d0fe;
  }
</style>
