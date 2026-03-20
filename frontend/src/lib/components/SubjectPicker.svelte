<script lang="ts">
  import type { WKSubject } from '@shared/types';

  let {
    subjects,
    onSelect,
  }: {
    subjects: WKSubject[];
    onSelect: (subject: WKSubject) => void;
  } = $props();

  function primaryMeaning(s: WKSubject): string {
    return s.data.meanings.find((m) => m.primary)?.meaning ?? '';
  }

  function primaryReading(s: WKSubject): string {
    return s.data.readings?.find((r) => r.primary)?.reading ?? '';
  }

  function subjectTypeColor(s: WKSubject): { bg: string; text: string; accent: string; border: string } {
    const type = s.object;
    if (type === 'vocabulary' || type === 'kana_vocabulary') {
      return { bg: 'bg-tertiary/10 dark:bg-purple-500/15', text: 'text-tertiary dark:text-purple-400', accent: 'text-tertiary dark:text-purple-400', border: 'ring-outline-variant/10' };
    }
    return { bg: 'bg-primary/10 dark:bg-pink-500/15', text: 'text-primary dark:text-pink-400', accent: 'text-primary dark:text-pink-400', border: 'ring-outline-variant/10' };
  }

  function subjectTypeLabel(s: WKSubject): string {
    if (s.object === 'kana_vocabulary') return 'Kana Vocab';
    return s.object.charAt(0).toUpperCase() + s.object.slice(1);
  }
</script>

<!-- Hero Instruction Section -->
<section class="mb-12">
  <h1 class="text-4xl font-extrabold font-headline tracking-tight text-on-surface dark:text-zinc-100 mb-2">Multiple matches found.</h1>
  <p class="text-lg text-on-surface-variant dark:text-zinc-400 font-body">Which one are you looking for?</p>
</section>

<!-- Bento Grid of Subjects -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
  {#each subjects as subject}
    {@const colors = subjectTypeColor(subject)}
    <button
      type="button"
      onclick={() => onSelect(subject)}
      class="group relative bg-surface-container-lowest dark:bg-zinc-900 rounded-lg p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:translate-y-[-4px] cursor-pointer ring-1 {colors.border} dark:ring-zinc-700 text-left"
    >
      <div class="flex justify-between items-start mb-6">
        <span class="px-3 py-1 {colors.bg} {colors.text} font-label text-xs font-bold tracking-widest uppercase rounded-full">
          {subjectTypeLabel(subject)}
        </span>
        <span class="px-3 py-1 bg-surface-container-high dark:bg-zinc-700 text-on-surface-variant dark:text-zinc-300 font-label text-xs font-bold rounded-full">
          Level {subject.data.level}
        </span>
      </div>

      <div class="flex flex-col gap-2 mb-8">
        {#if primaryReading(subject)}
          <span class="text-xs font-label text-on-surface-variant dark:text-zinc-500 uppercase tracking-[0.2em]">Reading</span>
          <span class="text-2xl font-medium font-body text-on-surface-variant dark:text-zinc-400">{primaryReading(subject)}</span>
        {/if}
        <span class="text-7xl font-black {colors.accent} font-headline tracking-tighter" lang="ja">
          {subject.data.characters}
        </span>
      </div>

      <div class="pt-6 border-t border-surface-container-high dark:border-zinc-700">
        <h3 class="text-xl font-bold font-headline text-on-surface dark:text-zinc-100 mb-1">{primaryMeaning(subject)}</h3>
      </div>

      <div class="absolute bottom-6 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
        <span class="material-symbols-outlined {colors.accent}">arrow_forward_ios</span>
      </div>
    </button>
  {/each}

  <!-- Help Tip Card -->
  <div class="bg-surface-container dark:bg-zinc-800 p-8 rounded-lg flex flex-col justify-center items-center text-center">
    <div class="w-16 h-16 bg-white dark:bg-zinc-700 rounded-full flex items-center justify-center mb-4 shadow-sm">
      <span class="material-symbols-outlined text-primary dark:text-pink-400 text-3xl">lightbulb</span>
    </div>
    <h4 class="font-headline font-bold text-on-surface dark:text-zinc-100 mb-2">Can't find the right one?</h4>
    <p class="text-sm text-on-surface-variant dark:text-zinc-400 mb-6 px-4">Try refining your search with specific readings or radical components.</p>
  </div>
</div>
