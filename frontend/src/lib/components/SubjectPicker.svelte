<script lang="ts">
  import type { WKSubject } from '@shared/types';

  let {
    subjects,
    onSelect,
  }: {
    subjects: WKSubject[];
    onSelect: (subject: WKSubject) => void;
  } = $props();

  let selectedIdx = $state(0);

  function primaryMeaning(s: WKSubject): string {
    return s.data.meanings.find((m) => m.primary)?.meaning ?? '';
  }

  function primaryReading(s: WKSubject): string {
    return s.data.readings?.find((r) => r.primary)?.reading ?? '';
  }

  function handleSelect() {
    onSelect(subjects[selectedIdx]);
  }
</script>

<div class="subject-picker">
  <h3>Multiple matches found — select one:</h3>
  <div class="options">
    {#each subjects as subject, i}
      <label class="option" class:selected={selectedIdx === i}>
        <input
          type="radio"
          name="subject"
          value={i}
          checked={selectedIdx === i}
          onchange={() => (selectedIdx = i)}
        />
        <span class="chars" lang="ja">{subject.data.characters}</span>
        <span class="reading">{primaryReading(subject)}</span>
        <span class="meaning">{primaryMeaning(subject)}</span>
        <span class="level">Lv. {subject.data.level}</span>
      </label>
    {/each}
  </div>
  <button onclick={handleSelect}>Select</button>
</div>

<style>
  .subject-picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    background: var(--surface);
    transition: border-color 0.15s;
  }
  .option.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  }
  .chars {
    font-size: 1.3rem;
    font-weight: 700;
    font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
  }
  .reading {
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .meaning {
    flex: 1;
    font-size: 0.9rem;
  }
  .level {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--bg);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }
  input[type='radio'] {
    accent-color: var(--accent);
  }
  button {
    align-self: flex-end;
    padding: 0.5rem 1.4rem;
    border: none;
    border-radius: 6px;
    background: var(--accent);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
</style>
