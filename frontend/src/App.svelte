<script lang="ts">
  import type { WKSubject, JishoWord, JotobaSentence, LookupResponse } from '@shared/types';
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
  let words = $state<JishoWord[]>([]);
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

  let hasToken = $derived(token.length > 0);

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
        pushPhase('pick_subject');
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
      pushPhase('preview');
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
      pushPhase('done');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed', 'error');
      phase = 'preview';
    }
  }

  // --- Browser history integration ---
  const historyPhases: Phase[] = ['pick_subject', 'preview', 'done'];

  function pushPhase(p: Phase) {
    if (historyPhases.includes(p)) {
      history.pushState({ phase: p }, '');
    }
  }

  function handlePopState() {
    // When the user hits back, return to idle (search)
    reset(true);
  }

  $effect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  });

  function reset(fromPopState = false) {
    if (!fromPopState && phase !== 'idle') {
      // If we're navigating away from a history-tracked phase, go back properly
      // But just resetting state is fine — we replace current state with idle
      history.replaceState({ phase: 'idle' }, '');
    }
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

<!-- TopAppBar -->
<header class="sticky top-0 z-50 bg-white/80 backdrop-blur-xl shadow-xl shadow-pink-900/5">
  <div class="flex justify-between items-center w-full px-6 py-4 max-w-5xl mx-auto">
    <button onclick={() => reset()} class="text-2xl font-black text-pink-700 tracking-tighter font-headline hover:text-pink-600 transition-colors cursor-pointer bg-transparent border-none p-0">ZenNotes</button>
    <div class="flex items-center gap-4">
      {#if hasToken}
        <span class="material-symbols-outlined text-green-600 text-sm" title="API token set">check_circle</span>
      {/if}
      <button class="p-2 rounded-full text-zinc-500 hover:bg-pink-50 transition-colors active:scale-95 duration-200">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>
  </div>
</header>

{#if statusMessage}
  <div class="max-w-5xl mx-auto px-6 pt-4">
    <StatusMessage message={statusMessage} type={statusType} />
  </div>
{/if}

<!-- Screen: Search / Setup (idle + loading) -->
{#if phase === 'idle' || phase === 'loading'}
  <main class="pt-24 pb-32 px-6 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
    <!-- Hero Branding -->
    <div class="text-center mb-12 relative">
      <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-10"></div>
      <h1 class="font-headline text-5xl md:text-7xl font-extrabold text-on-surface tracking-tighter mb-4">
        言葉 <span class="text-primary">Curator</span>
      </h1>
      <p class="text-on-surface-variant font-body text-lg max-w-md mx-auto leading-relaxed">
        Connect your WaniKani knowledge and find the soul behind every character.
      </p>
    </div>

    <!-- Central Action Card -->
    <div class="w-full max-w-2xl bg-surface-container-lowest rounded-lg p-8 md:p-12 relative group">
      {#if !hasToken}
        <div class="absolute -top-4 -right-4 bg-tertiary text-white font-label text-[10px] tracking-widest uppercase py-2 px-4 rounded-lg shadow-lg rotate-3">
          Setup Required
        </div>
      {/if}

      <div class="space-y-10">
        <!-- API Token Section -->
        <TokenInput bind:token onTokenChange={(t) => (token = t)} />

        <!-- Search Section -->
        <WordForm onSubmit={handleLookup} loading={phase === 'loading'} disabled={!hasToken} />
      </div>
    </div>

    <!-- Decorative Grid -->
    <div class="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 w-full opacity-40 grayscale hover:grayscale-0 transition-all duration-700 pointer-events-none">
      <div class="bg-surface-container p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square">
        <span class="text-4xl text-primary font-headline">雨</span>
        <span class="font-label text-[10px] tracking-widest uppercase">Rain</span>
      </div>
      <div class="bg-surface-container p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square translate-y-4">
        <span class="text-4xl text-secondary font-headline">海</span>
        <span class="font-label text-[10px] tracking-widest uppercase">Sea</span>
      </div>
      <div class="bg-surface-container p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square">
        <span class="text-4xl text-tertiary font-headline">光</span>
        <span class="font-label text-[10px] tracking-widest uppercase">Light</span>
      </div>
      <div class="bg-surface-container p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square translate-y-4">
        <span class="text-4xl text-primary font-headline">友</span>
        <span class="font-label text-[10px] tracking-widest uppercase">Friend</span>
      </div>
    </div>
  </main>
{/if}

<!-- Screen: Subject Selection -->
{#if phase === 'pick_subject'}
  <main class="pt-24 pb-32 px-6 max-w-5xl mx-auto">
    <SubjectPicker {subjects} onSelect={selectSubject} />
  </main>
{/if}

<!-- Screen: Generating (loading state) -->
{#if phase === 'generating'}
  <main class="pt-24 pb-32 px-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
    <div class="bg-surface-container-lowest p-12 rounded-xl flex flex-col items-center gap-4 pulse-loading">
      <span class="material-symbols-outlined text-primary text-5xl">auto_awesome</span>
      <span class="font-label text-xs font-bold tracking-widest text-primary uppercase">Curating context...</span>
    </div>
  </main>
{/if}

<!-- Screen: Note Preview / Edit -->
{#if phase === 'preview' || phase === 'saving'}
  <main class="max-w-4xl mx-auto px-6 pt-12 pb-32">
    {#if selectedSubject}
      <NotePreview
        subject={selectedSubject}
        bind:noteText
        bind:synonyms
        onSave={handleSave}
        saving={phase === 'saving'}
      />
    {/if}
  </main>
{/if}

<!-- Screen: Success -->
{#if phase === 'done'}
  <main class="max-w-5xl mx-auto px-6 pt-12 pb-32">
    <section class="flex flex-col items-center text-center mb-16 relative">
      <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
      <div class="w-24 h-24 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center shadow-xl shadow-primary/20 mb-6">
        <span class="material-symbols-outlined text-white text-5xl" style="font-variation-settings: 'FILL' 1;">check_circle</span>
      </div>
      <h1 class="font-headline font-extrabold text-4xl text-on-surface tracking-tight mb-2">Note Saved!</h1>
      <p class="text-on-surface-variant max-w-sm mb-8">Your new study artifact has been successfully curated into your personal library.</p>
      <button
        onclick={() => reset()}
        class="bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold px-8 py-4 rounded-full shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2 active:scale-95"
      >
        <span class="material-symbols-outlined text-xl">search</span>
        Search Another Word
      </button>
    </section>
  </main>
{/if}
