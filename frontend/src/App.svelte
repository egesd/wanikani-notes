<script lang="ts">
  import type { WKSubject, JotobaWord, JotobaSentence, LookupResponse } from '@shared/types';
  import { lookup, generate, save } from './lib/api';
  import TokenInput from './lib/components/TokenInput.svelte';
  import WordForm from './lib/components/WordForm.svelte';
  import SubjectPicker from './lib/components/SubjectPicker.svelte';
  import NotePreview from './lib/components/NotePreview.svelte';
  import StatusMessage from './lib/components/StatusMessage.svelte';

  type Phase = 'idle' | 'loading' | 'pick_subject' | 'generating' | 'preview' | 'saving' | 'done';

  let token = $state('');
  let phase = $state<Phase>('idle');

  // lookup results
  let subjects = $state<WKSubject[]>([]);
  let words = $state<JotobaWord[]>([]);
  let sentences = $state<JotobaSentence[]>([]);

  // selected subject + generated note
  let selectedSubject = $state<WKSubject | null>(null);
  let noteText = $state('');
  let synonyms = $state<string[]>([]);

  // status
  let statusMessage = $state('');
  let statusType = $state<'success' | 'error' | 'info'>('info');

  // simple client-side cache
  const lookupCache = new Map<string, LookupResponse>();

  function setStatus(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    statusMessage = msg;
    statusType = type;
  }

  function clearStatus() {
    statusMessage = '';
  }

  async function handleLookup(word: string) {
    if (!token) {
      setStatus('Please enter your WaniKani API token first.', 'error');
      return;
    }

    clearStatus();
    phase = 'loading';

    try {
      let result: LookupResponse;
      if (lookupCache.has(word)) {
        result = lookupCache.get(word)!;
      } else {
        result = await lookup(word, token);
        lookupCache.set(word, result);
      }

      subjects = result.subjects;
      words = result.words;
      sentences = result.sentences;

      if (subjects.length === 0) {
        setStatus(`No WaniKani vocabulary found for "${word}".`, 'error');
        phase = 'idle';
        return;
      }

      if (subjects.length === 1) {
        await selectSubject(subjects[0]);
      } else {
        phase = 'pick_subject';
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Lookup failed', 'error');
      phase = 'idle';
    }
  }

  async function selectSubject(subject: WKSubject) {
    selectedSubject = subject;
    phase = 'generating';
    clearStatus();

    try {
      const result = await generate({ subject, words, sentences });
      noteText = result.noteText;
      synonyms = result.synonyms;
      phase = 'preview';
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Note generation failed', 'error');
      phase = 'idle';
    }
  }

  async function handleSave() {
    if (!selectedSubject) return;
    phase = 'saving';
    clearStatus();

    try {
      const result = await save({
        token,
        subjectId: selectedSubject.id,
        meaningNote: noteText,
        meaningSynonyms: synonyms,
      });

      setStatus(
        `Study material ${result.action} for ${selectedSubject.data.characters}!`,
        'success',
      );
      phase = 'done';
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed', 'error');
      phase = 'preview';
    }
  }

  function reset() {
    phase = 'idle';
    subjects = [];
    words = [];
    sentences = [];
    selectedSubject = null;
    noteText = '';
    synonyms = [];
    clearStatus();
  }
</script>

<main>
  <h1>WaniKani Study Notes</h1>

  <section class="card">
    <TokenInput bind:token onTokenChange={(t) => (token = t)} />
  </section>

  <section class="card">
    <WordForm onSubmit={handleLookup} loading={phase === 'loading'} />
  </section>

  {#if statusMessage}
    <StatusMessage message={statusMessage} type={statusType} />
  {/if}

  {#if phase === 'pick_subject'}
    <section class="card">
      <SubjectPicker {subjects} onSelect={selectSubject} />
    </section>
  {/if}

  {#if phase === 'generating'}
    <section class="card loading-card">
      Generating note…
    </section>
  {/if}

  {#if phase === 'preview' || phase === 'saving'}
    <section class="card">
      {#if selectedSubject}
        <NotePreview
          subject={selectedSubject}
          bind:noteText
          bind:synonyms
          onSave={handleSave}
          saving={phase === 'saving'}
        />
      {/if}
    </section>
  {/if}

  {#if phase === 'done'}
    <button class="reset-btn" onclick={reset}>Look up another word</button>
  {/if}
</main>

<style>
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    margin: 0 0 0.5rem;
  }
  .card {
    padding: 1.2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .loading-card {
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
  }
  .reset-btn {
    padding: 0.55rem 1.4rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
    align-self: center;
  }
</style>
