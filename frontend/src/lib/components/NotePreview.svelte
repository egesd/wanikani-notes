<script lang="ts">
  import type { WKSubject } from '@shared/types';

  let {
    subject,
    noteText = $bindable(''),
    synonyms = $bindable<string[]>([]),
    onSave,
    saving = false,
  }: {
    subject: WKSubject;
    noteText: string;
    synonyms: string[];
    onSave: () => void;
    saving?: boolean;
  } = $props();

  let synonymInput = $state('');

  function primaryMeaning(): string {
    return subject.data.meanings.find((m) => m.primary)?.meaning ?? '';
  }

  function primaryReading(): string {
    return subject.data.readings?.find((r) => r.primary)?.reading ?? '';
  }

  function addSynonym() {
    const val = synonymInput.trim();
    if (val && !synonyms.includes(val)) {
      synonyms = [...synonyms, val];
    }
    synonymInput = '';
  }

  function removeSynonym(idx: number) {
    synonyms = synonyms.filter((_, i) => i !== idx);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSynonym();
    }
  }
</script>

<div class="note-preview">
  <div class="subject-card">
    <span class="chars" lang="ja">{subject.data.characters}</span>
    <div class="meta">
      <span class="reading">{primaryReading()}</span>
      <span class="meaning">{primaryMeaning()}</span>
      <span class="level">Level {subject.data.level}</span>
    </div>
  </div>

  <label for="note-textarea" class="section-label">Generated Note</label>
  <textarea
    id="note-textarea"
    bind:value={noteText}
    rows="10"
  ></textarea>

  <div class="synonyms-section">
    <span class="section-label">Synonyms to save</span>
    <div class="synonym-tags">
      {#each synonyms as syn, i}
        <span class="tag">
          {syn}
          <button class="remove-tag" onclick={() => removeSynonym(i)}>&times;</button>
        </span>
      {/each}
    </div>
    <div class="synonym-add">
      <input
        type="text"
        placeholder="Add synonym…"
        bind:value={synonymInput}
        onkeydown={handleKeydown}
      />
      <button type="button" onclick={addSynonym} disabled={!synonymInput.trim()}>+</button>
    </div>
  </div>

  <button class="save-btn" onclick={onSave} disabled={saving}>
    {#if saving}
      Saving…
    {:else}
      Add to WaniKani
    {/if}
  </button>
</div>

<style>
  .note-preview {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .subject-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .chars {
    font-size: 2rem;
    font-weight: 700;
    font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .reading {
    font-size: 0.95rem;
    color: var(--text-muted);
  }
  .meaning {
    font-size: 1.05rem;
    font-weight: 600;
  }
  .level {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .section-label {
    font-weight: 600;
    font-size: 0.85rem;
  }
  textarea {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    background: var(--surface);
    color: var(--text);
    box-sizing: border-box;
  }
  .synonyms-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .synonym-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.55rem;
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
    border-radius: 4px;
    font-size: 0.85rem;
  }
  .remove-tag {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
    color: var(--text-muted);
  }
  .synonym-add {
    display: flex;
    gap: 0.35rem;
  }
  .synonym-add input {
    flex: 1;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--surface);
    color: var(--text);
  }
  .synonym-add button {
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
    font-size: 1rem;
    color: var(--text);
  }
  .synonym-add button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .save-btn {
    padding: 0.65rem 1.6rem;
    border: none;
    border-radius: 6px;
    background: #1a9c3e;
    color: white;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    align-self: flex-start;
  }
  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
