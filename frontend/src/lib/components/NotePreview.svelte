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

  function subjectTypeLabel(): string {
    if (subject.object === 'kana_vocabulary') return 'Kana Vocab';
    return subject.object.charAt(0).toUpperCase() + subject.object.slice(1);
  }

  function typeColor(): string {
    if (subject.object === 'vocabulary' || subject.object === 'kana_vocabulary') return 'tertiary';
    return 'primary';
  }
</script>

<!-- Hero Header: Kanji Artifact -->
<section class="flex flex-col md:flex-row items-end gap-6 mb-12">
  <div class="relative group">
    <div class="absolute -inset-1 bg-gradient-to-r from-primary to-tertiary rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
    <div class="relative bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col items-center min-w-[180px]">
      <h1 class="font-headline font-extrabold text-7xl text-{typeColor()} kanji-hero-text" lang="ja">
        {subject.data.characters}
      </h1>
      {#if primaryReading()}
        <p class="font-label text-sm font-semibold tracking-widest text-outline mt-4 uppercase">
          {primaryReading()}
        </p>
      {/if}
    </div>
  </div>
  <div class="flex-1 pb-2">
    <h2 class="font-headline font-bold text-3xl text-on-surface mb-2 tracking-tight">{primaryMeaning()}</h2>
    <div class="flex gap-2">
      {#if subject.data.level}
        <span class="px-3 py-1 bg-secondary/10 text-secondary font-label text-xs font-bold rounded-full">
          Level {subject.data.level}
        </span>
      {/if}
      <span class="px-3 py-1 bg-{typeColor()}/10 text-{typeColor()} font-label text-xs font-bold rounded-full">
        {subjectTypeLabel()}
      </span>
    </div>
  </div>
</section>

<!-- Content Bento Grid -->
<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
  <!-- Generated Note Section (Primary) -->
  <div class="lg:col-span-8 space-y-8">
    <div class="bg-surface-container-lowest p-8 rounded-xl shadow-sm relative overflow-hidden">
      <div class="flex items-center justify-between mb-8">
        <h3 class="font-headline font-bold text-xl text-on-surface">Generated Note</h3>
      </div>

      <div class="space-y-6">
        <!-- Context Section -->
        <div>
          <label for="note-textarea" class="font-label text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2 block">
            Context & Nuance
          </label>
          <textarea
            id="note-textarea"
            bind:value={noteText}
            rows="12"
            class="w-full bg-surface-container-low border-none rounded-lg font-body text-on-surface p-4 leading-relaxed focus:ring-1 focus:ring-primary/30 min-h-[280px] resize-y"
          ></textarea>
        </div>

        <!-- Extra Notes Section -->
        <div>
          <label for="personal-notes" class="font-label text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2 block">
            Something more to add?
          </label>
          <textarea
            id="personal-notes"
            placeholder="Add your personal mnemonics here..."
            rows="3"
            class="w-full bg-surface-container-low border-none rounded-lg font-body text-on-surface p-4 leading-relaxed focus:ring-1 focus:ring-primary/30 resize-y"
          ></textarea>
        </div>
      </div>
    </div>
  </div>

  <!-- Meaning & Action Column -->
  <div class="lg:col-span-4 space-y-6">
    <!-- Synonyms Card -->
    <div class="bg-surface-container p-6 rounded-xl space-y-4">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-secondary">security</span>
        <h3 class="font-headline font-bold text-sm text-on-surface">Meaning Synonyms</h3>
      </div>
      <p class="font-label text-[10px] text-on-surface-variant/70 leading-relaxed uppercase tracking-wider">
        Conservative mapping for WaniKani
      </p>

      <div class="flex flex-wrap gap-2">
        {#each synonyms as syn, i}
          <span class="bg-surface-container-lowest px-3 py-2 rounded-lg font-body text-sm border-b-2 border-secondary/20 flex items-center gap-1">
            {syn}
            <button
              type="button"
              onclick={() => removeSynonym(i)}
              class="text-on-surface-variant/50 hover:text-error text-sm leading-none ml-1"
            >&times;</button>
          </span>
        {/each}
      </div>

      <div class="flex gap-2">
        <input
          type="text"
          placeholder="Add synonym…"
          bind:value={synonymInput}
          onkeydown={handleKeydown}
          class="flex-1 min-w-0 bg-surface-container-lowest border-none rounded-lg px-3 py-2 font-body text-sm text-on-surface outline outline-1 outline-outline-variant/20 focus:outline-secondary focus:ring-0"
        />
        <button
          type="button"
          onclick={addSynonym}
          disabled={!synonymInput.trim()}
          class="flex items-center justify-center gap-1 font-label text-[10px] font-bold text-secondary uppercase tracking-wider hover:bg-secondary/5 px-2 py-2 rounded-lg transition-colors disabled:opacity-40 shrink-0"
        >
          <span class="material-symbols-outlined text-sm">add</span>
          Add
        </button>
      </div>
    </div>

    <!-- Call to Action -->
    <div class="pt-4">
      <button
        onclick={onSave}
        disabled={saving}
        class="w-full py-5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-extrabold text-lg shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-3 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if saving}
          <span class="material-symbols-outlined animate-spin">progress_activity</span>
          Saving...
        {:else}
          <span class="material-symbols-outlined group-hover:rotate-12 transition-transform">send</span>
          Save to WaniKani
        {/if}
      </button>
      <p class="text-center mt-4 font-label text-[10px] text-outline font-medium">Auto-syncs with your WK account API</p>
    </div>

    <!-- Info Tooltip -->
    <div class="bg-white/40 backdrop-blur-md p-4 rounded-xl border border-white/20 flex items-start gap-3">
      <span class="material-symbols-outlined text-tertiary">info</span>
      <p class="font-body text-xs text-on-surface-variant leading-relaxed">
        Generated from Jisho dictionary data. Review before saving.
      </p>
    </div>
  </div>
</div>
