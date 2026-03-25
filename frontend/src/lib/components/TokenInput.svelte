<script lang="ts">
  import { loadToken, saveToken, clearToken } from '../tokenStore';
  import { onMount } from 'svelte';

  let { token = $bindable(''), onTokenChange }: { token: string; onTokenChange?: (t: string) => void } = $props();
  let persist = $state(false);

  onMount(() => {
    const saved = loadToken();
    if (saved) {
      token = saved;
      persist = true;
      onTokenChange?.(saved);
    }
  });

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    token = val;
    if (persist) saveToken(val);
    onTokenChange?.(val);
  }

  function togglePersist() {
    persist = !persist;
    if (persist) {
      saveToken(token);
    } else {
      clearToken();
    }
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between px-1">
    <label for="api-token" class="font-label text-xs uppercase tracking-widest text-on-surface-variant dark:text-zinc-400 flex items-center gap-2">
      <span class="material-symbols-outlined text-base text-primary dark:text-pink-400">vpn_key</span>
      WaniKani API Token
    </label>
    <label class="flex items-center gap-2 font-label text-xs text-primary dark:text-pink-400 cursor-pointer hover:underline decoration-2 underline-offset-4">
      <input
        type="checkbox"
        checked={persist}
        onchange={togglePersist}
        class="rounded text-primary focus:ring-primary/30 border-outline-variant/30 w-3.5 h-3.5"
      />
      Save in browser
    </label>
  </div>
  <div class="relative group/token">
    <input
      id="api-token"
      type="password"
      placeholder="••••••••••••••••••••••••••••"
      value={token}
      oninput={handleInput}
      autocomplete="off"
      class="input-glow w-full bg-surface-container-low dark:bg-zinc-800/80 border-none rounded-xl px-6 py-4 focus:ring-0 focus:bg-white dark:focus:bg-zinc-700 transition-all duration-300 placeholder:text-outline-variant/40 dark:placeholder:text-zinc-600 text-on-surface dark:text-zinc-100 font-mono outline outline-2 outline-outline-variant/15 dark:outline-zinc-700/80 focus:outline-primary dark:focus:outline-pink-500 shadow-sm focus:shadow-lg focus:shadow-primary/10 dark:focus:shadow-pink-500/10"
    />
    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant/60 dark:text-zinc-500 group-focus-within/token:text-primary dark:group-focus-within/token:text-pink-400 transition-colors duration-300">
      <span class="material-symbols-outlined">key</span>
    </div>
  </div>
</div>
