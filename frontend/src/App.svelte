<script lang="ts">
  import { tick } from 'svelte';
  import type { WKSubject, LexicalEntry, SentenceExample, LookupResponse } from '@shared/types';
  import { lookup, generate, save } from './lib/api';
  import { loadTheme, saveTheme, applyTheme, type Theme } from './lib/themeStore';
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
  let lexical = $state<LexicalEntry[]>([]);
  let sentences = $state<SentenceExample[]>([]);

  // selected subject + generated note
  let selectedSubject = $state<WKSubject | null>(null);
  let noteText = $state('');
  let synonyms = $state<string[]>([]);

  // status
  let statusMessage = $state('');
  let statusType = $state<'success' | 'error' | 'info'>('info');

  // simple client-side cache
  const lookupCache = new Map<string, LookupResponse>();

  // --- Dark mode ---
  let theme = $state<Theme>('light');
  let isDark = $derived(theme === 'dark');

  $effect(() => {
    theme = loadTheme();
    applyTheme(theme);
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    saveTheme(theme);
    applyTheme(theme);
  }

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
      lexical = result.lexical;
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
      const result = await generate({ subject, lexical, sentences });
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

  let wordFormRef = $state<ReturnType<typeof WordForm>>();

  $effect(() => {
    if (phase === 'idle' && hasToken) {
      tick().then(() => wordFormRef?.focus());
    }
  });

  function reset(fromPopState = false) {
    if (!fromPopState && phase !== 'idle') {
      // If we're navigating away from a history-tracked phase, go back properly
      // But just resetting state is fine — we replace current state with idle
      history.replaceState({ phase: 'idle' }, '');
    }
    phase = 'idle';
    subjects = [];
    lexical = [];
    sentences = [];
    selectedSubject = null;
    noteText = '';
    synonyms = [];
    clearStatus();
  }
</script>

<!-- TopAppBar -->
<header class="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-xl shadow-pink-900/5 dark:shadow-zinc-950/50">
  <div class="flex justify-between items-center w-full px-6 py-4 max-w-5xl mx-auto">
    <button onclick={() => reset()} class="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0">
      <img src="/assets/KaniNotesLogoDark.png" alt="KaniNotes" class="h-14 w-auto" />
      <span class="text-2xl font-black text-pink-700 dark:text-pink-400 tracking-tighter font-headline">KaniNotes</span>
    </button>
    <button
      onclick={toggleTheme}
      class="theme-toggle"
      class:dark={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span class="material-symbols-outlined toggle-icon sun">light_mode</span>
      <span class="material-symbols-outlined toggle-icon moon">dark_mode</span>
      <span class="toggle-thumb"></span>
    </button>
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
      <h1 class="font-headline text-5xl md:text-7xl font-extrabold text-on-surface dark:text-zinc-100 tracking-tighter mb-4">
        言葉 <span class="text-primary dark:text-pink-400">Curator</span>
      </h1>
      <p class="text-on-surface-variant dark:text-zinc-400 font-body text-lg max-w-md mx-auto leading-relaxed">
        Connect your WaniKani knowledge and find the soul behind every character.
      </p>
    </div>

    <!-- Central Action Card -->
    <div class="w-full max-w-2xl bg-surface-container-lowest dark:bg-zinc-900 rounded-2xl p-8 md:p-12 relative group shadow-xl shadow-black/[0.03] dark:shadow-black/30 ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      {#if !hasToken}
        <div class="absolute -top-4 -right-4 bg-tertiary text-white font-label text-[10px] tracking-widest uppercase py-2 px-4 rounded-lg shadow-lg rotate-3">
          Setup Required
        </div>
      {/if}

      <div class="space-y-8">
        <!-- API Token Section -->
        <TokenInput bind:token onTokenChange={(t) => (token = t)} />

        <!-- Divider -->
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-outline-variant/20 dark:border-zinc-700/50"></div>
          </div>
          <div class="relative flex justify-center">
            <span class="bg-surface-container-lowest dark:bg-zinc-900 px-4">
              <span class="material-symbols-outlined text-outline-variant/40 dark:text-zinc-600 text-sm">arrow_downward</span>
            </span>
          </div>
        </div>

        <!-- Search Section -->
        <WordForm bind:this={wordFormRef} onSubmit={handleLookup} loading={phase === 'loading'} disabled={!hasToken} />
      </div>
    </div>

    <!-- Decorative Grid -->
    <div class="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 w-full opacity-90 dark:opacity-80 hover:grayscale-0 transition-all duration-700 pointer-events-none">
      <div class="bg-surface-container dark:bg-zinc-800/80 dark:shadow-[0_0_20px_rgba(236,72,153,0.15)] p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square">
        <span class="text-4xl text-primary dark:text-pink-400 dark:drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] font-headline">雨</span>
        <span class="font-label text-[10px] tracking-widest uppercase text-on-surface-variant dark:text-zinc-300">Rain</span>
      </div>
      <div class="bg-surface-container dark:bg-zinc-800/80 dark:shadow-[0_0_20px_rgba(96,165,250,0.15)] p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square translate-y-4">
        <span class="text-4xl text-secondary dark:text-blue-400 dark:drop-shadow-[0_0_8px_rgba(96,165,250,0.5)] font-headline">海</span>
        <span class="font-label text-[10px] tracking-widest uppercase text-on-surface-variant dark:text-zinc-300">Sea</span>
      </div>
      <div class="bg-surface-container dark:bg-zinc-800/80 dark:shadow-[0_0_20px_rgba(192,132,252,0.15)] p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square">
        <span class="text-4xl text-tertiary dark:text-purple-400 dark:drop-shadow-[0_0_8px_rgba(192,132,252,0.5)] font-headline">光</span>
        <span class="font-label text-[10px] tracking-widest uppercase text-on-surface-variant dark:text-zinc-300">Light</span>
      </div>
      <div class="bg-surface-container dark:bg-zinc-800/80 dark:shadow-[0_0_20px_rgba(236,72,153,0.15)] p-6 rounded-lg flex flex-col items-center justify-center gap-2 aspect-square translate-y-4">
        <span class="text-4xl text-primary dark:text-pink-400 dark:drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] font-headline">友</span>
        <span class="font-label text-[10px] tracking-widest uppercase text-on-surface-variant dark:text-zinc-300">Friend</span>
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
    <div class="bg-surface-container-lowest dark:bg-zinc-900 p-12 rounded-xl flex flex-col items-center gap-4 pulse-loading">
      <span class="material-symbols-outlined text-primary dark:text-pink-400 text-5xl">auto_awesome</span>
      <span class="font-label text-xs font-bold tracking-widest text-primary dark:text-pink-400 uppercase">Curating context...</span>
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
      <div class="w-24 h-24 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center shadow-xl shadow-primary/20 dark:shadow-primary/10 mb-6">
        <span class="material-symbols-outlined text-white text-5xl" style="font-variation-settings: 'FILL' 1;">check_circle</span>
      </div>
      <h1 class="font-headline font-extrabold text-4xl text-on-surface dark:text-zinc-100 tracking-tight mb-2">Note Saved!</h1>
      <p class="text-on-surface-variant dark:text-zinc-400 max-w-sm mb-8">Your new study artifact has been successfully curated into your personal library.</p>
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
