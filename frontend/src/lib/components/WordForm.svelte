<script lang="ts">
  let {
    onSubmit,
    loading = false,
  }: {
    onSubmit: (word: string) => void;
    loading?: boolean;
  } = $props();

  let word = $state('');

  function handleSubmit(e: Event) {
    e.preventDefault();
    const trimmed = word.trim();
    if (trimmed) onSubmit(trimmed);
  }
</script>

<form class="word-form" onsubmit={handleSubmit}>
  <label for="word-input">Japanese Word</label>
  <div class="input-row">
    <input
      id="word-input"
      type="text"
      placeholder="e.g. 贈賄"
      bind:value={word}
      disabled={loading}
      lang="ja"
    />
    <button type="submit" disabled={loading || !word.trim()}>
      {#if loading}
        Looking up…
      {:else}
        Look Up
      {/if}
    </button>
  </div>
</form>

<style>
  .word-form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .word-form > label {
    font-weight: 600;
    font-size: 0.85rem;
  }
  .input-row {
    display: flex;
    gap: 0.5rem;
  }
  input[type='text'] {
    flex: 1;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 1.1rem;
    font-family: inherit;
    background: var(--surface);
    color: var(--text);
  }
  input[type='text']:lang(ja) {
    font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
  }
  button {
    padding: 0.55rem 1.2rem;
    border: none;
    border-radius: 6px;
    background: var(--accent);
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    white-space: nowrap;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
