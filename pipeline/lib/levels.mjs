/**
 * Level rules from docs/02-CONTENT-SPEC.md (app repo).
 * A text passes when >= rule.minCoverage of its words are in the level pool
 * (proper nouns count as in-pool), no sentence exceeds maxSentenceWords,
 * and total word count is within [minWords, maxWords].
 *
 * Reading-time standard: 200 words/min. Duration bands per level below are
 * derived from the word-count bands at that speed and drive the "X min" chip.
 */
export const MIN_COVERAGE = 0.95;

/** Reading speed used to derive minute bands from word counts. */
export const READING_WPM = 200;

/**
 * Levels the generation pipeline auto-produces for every story (run-batch,
 * generate-summaries, generate-cover). C1 is intentionally NOT here: C1 has
 * its own production track (v2 Faz 1/3) with a dedicated prompt, so adding it
 * to this set would make run-batch attempt C1 generation with no prompt.
 */
export const LEVELS = ['A1', 'A2', 'B1', 'B2'];

/**
 * Every level the app and the audit know about, C1 included. Validation and
 * the content audit iterate the levels actually present in each story, so this
 * list just documents the full ladder A1 -> C1.
 */
export const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const LEVEL_RULES = {
  A1: {
    poolFile: 'ngsl-500.txt',
    poolLabel: 'NGSL first 500',
    maxSentenceWords: 8,
    minWords: 250,
    maxWords: 400,
    minCoverage: 0.95,
    minutes: '1-2 min',
    grammar: 'Present simple and present continuous only.',
  },
  A2: {
    poolFile: 'ngsl-1000.txt',
    poolLabel: 'NGSL first 1000',
    maxSentenceWords: 12,
    minWords: 400,
    maxWords: 600,
    minCoverage: 0.95,
    minutes: '2-3 min',
    grammar: 'Adds past simple and "going to" future.',
  },
  B1: {
    poolFile: 'ngsl-2000.txt',
    poolLabel: 'NGSL first 2000',
    maxSentenceWords: 16,
    minWords: 600,
    maxWords: 900,
    minCoverage: 0.95,
    minutes: '3-4 min',
    grammar: 'Adds present perfect and first conditional.',
  },
  B2: {
    poolFile: 'ngsl-2800.txt',
    poolLabel: 'NGSL first 2800',
    maxSentenceWords: 22,
    minWords: 900,
    maxWords: 1400,
    minCoverage: 0.95,
    minutes: '4-5 min',
    grammar: 'Adds passive voice, second/third conditionals, relative clauses.',
  },
  C1: {
    // C1 by CEFR exceeds any fixed NGSL cut; the strict "controlled vocabulary"
    // model loosens here. We keep the widest pool we have (NGSL 2800) as the
    // base and allow up to 10% advanced/literary words out of pool (minCoverage
    // 0.90) rather than inventing a wordlist we do not own. The C1 identity is
    // carried by length, sentence complexity and literary freedom, not by a
    // larger controlled list. Band 1000-1700 words covers both C1 tracks:
    // upgrades of existing stories (min ~1000 words / 5 min) and new C1
    // productions (~1400-1600 words / 7-8 min).
    poolFile: 'ngsl-2800.txt',
    poolLabel: 'NGSL 2800 + up to 10% advanced/literary vocabulary',
    maxSentenceWords: 32,
    minWords: 1000,
    maxWords: 1700,
    minCoverage: 0.9,
    minutes: '5-8 min',
    grammar:
      'Full range: inversion, cleft sentences, subjunctive, nuanced modality, ' +
      'extended participial and relative clauses, advanced discourse markers.',
  },
};

export const GENRES = ['horror', 'mystery', 'adventure', 'romance', 'scifi', 'daily', 'classic'];
