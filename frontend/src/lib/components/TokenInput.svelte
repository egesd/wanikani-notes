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

<div class="space-y-4">
  <div class="flex items-center justify-between px-1">
    <label for="api-token" class="font-label text-xs uppercase tracking-widest text-on-surface-variant">
      WaniKani API Token
    </label>
    <label class="flex items-center gap-2 font-label text-xs text-primary cursor-pointer hover:underline decoration-2 underline-offset-4">
      <input
        type="checkbox"
        checked={persist}
        onchange={togglePersist}
        class="rounded text-primary focus:ring-primary/30 border-outline-variant/30 w-3.5 h-3.5"
      />
      Save in browser
    </label>
  </div>
  <div class="relative">
    <input
      id="api-token"
      type="password"
      placeholder="••••••••••••••••••••••••••••"
      value={token}
      oninput={handleInput}
      autocomplete="off"
      class="w-full bg-surface-container-low border-none rounded-lg px-6 py-4 focus:ring-0 focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-outline-variant/50 text-on-surface font-mono outline outline-1 outline-outline-variant/20 focus:outline-primary"
    />
    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant">
      <span class="material-symbols-outlined">key</span>
    </div>
  </div>
</div>
