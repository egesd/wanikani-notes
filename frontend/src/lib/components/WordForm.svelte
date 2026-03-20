<script lang="ts">
  let {
    onSubmit,
    loading = false,
    disabled = false,
  }: {
    onSubmit: (word: string) => void;
    loading?: boolean;
    disabled?: boolean;
  } = $props();

  let word = $state('');

  function handleSubmit(e: Event) {
    e.preventDefault();
    const trimmed = word.trim();
    if (trimmed) onSubmit(trimmed);
  }
</script>

<div class="space-y-4">
  <label for="word-input" class="font-label text-xs uppercase tracking-widest text-on-surface-variant dark:text-zinc-400 px-1">
    Find Vocabulary
  </label>
  <form onsubmit={handleSubmit} class="relative">
    <input
      id="word-input"
      type="text"
      placeholder="Type a word in Japanese..."
      bind:value={word}
      disabled={loading || disabled}
      lang="ja"
      class="w-full bg-surface-container-low dark:bg-zinc-800 border-none rounded-lg px-6 py-5 text-xl font-headline focus:ring-0 focus:bg-surface-container-lowest dark:focus:bg-zinc-700 transition-all duration-300 placeholder:text-outline-variant/50 dark:placeholder:text-zinc-600 text-on-surface dark:text-zinc-100 outline outline-1 outline-outline-variant/20 dark:outline-zinc-700 focus:outline-secondary disabled:opacity-50"
    />
    <button
      type="submit"
      disabled={loading || disabled || !word.trim()}
      class="absolute right-4 top-1/2 -translate-y-1/2 text-secondary dark:text-blue-400 disabled:text-outline-variant/50"
    >
      <span class="material-symbols-outlined text-3xl">search</span>
    </button>
  </form>

  <!-- Primary CTA -->
  <div class="pt-4">
    <button
      onclick={() => { const trimmed = word.trim(); if (trimmed) onSubmit(trimmed); }}
      disabled={loading || disabled || !word.trim()}
      class="w-full bg-gradient-to-r from-primary to-primary-container text-white font-headline text-lg py-5 rounded-full shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if loading}
        <span class="material-symbols-outlined animate-spin">progress_activity</span>
        Looking up...
      {:else}
        Find Vocabulary
        <span class="material-symbols-outlined">arrow_forward</span>
      {/if}
    </button>
  </div>
</div>
