<script lang="ts">
  import { loadToken, saveToken, clearToken } from '../tokenStore';

  let { token = $bindable(''), onTokenChange }: { token: string; onTokenChange?: (t: string) => void } = $props();
  let persist = $state(false);

  $effect(() => {
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

<div class="token-input">
  <label for="api-token">WaniKani API Token</label>
  <input
    id="api-token"
    type="password"
    placeholder="Enter your WaniKani API token"
    value={token}
    oninput={handleInput}
    autocomplete="off"
  />
  <label class="persist-label">
    <input type="checkbox" checked={persist} onchange={togglePersist} />
    Save in browser
  </label>
</div>

<style>
  .token-input {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .token-input > label:first-child {
    font-weight: 600;
    font-size: 0.85rem;
  }
  input[type='password'] {
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.95rem;
    background: var(--surface);
    color: var(--text);
  }
  .persist-label {
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--text-muted);
    cursor: pointer;
  }
</style>
