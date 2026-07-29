/**
 * Content-safety scanner for the LYMIA audit (Apple 4+ compliance).
 *
 * Matching is whole-word, using FORWARD inflection generation, never raw
 * substring and never the coverage lemmatizer's backward stemming. We take
 * each list lemma (e.g. "kill") and expand it to its real inflected forms
 * (kill/kills/killed/killing), then match tokens exactly against that set.
 * Forward generation is collision-free: it can never turn the everyday word
 * "did" into "die" the way backward stemming does, and tokenizing first means
 * "class" never trips "ass". Phrases are matched as word-bounded substrings.
 *
 * Tier 1 hits are hard failures. Tier 2 hits are review-only warnings
 * (legitimate in the horror/mystery genres at a spooky level).
 */
import { readFileSync } from 'node:fs';

import { tokenizeWords } from './tokenize.mjs';

const data = JSON.parse(
  readFileSync(new URL('../../wordlists/forbidden-content.json', import.meta.url), 'utf8'),
);

/** Conservative forward inflections of a base word (regular English morphology). */
export function wordForms(base) {
  const b = base.toLowerCase();
  const forms = new Set([b]);

  // plural / 3rd-person singular
  if (/(s|x|z|ch|sh)$/.test(b)) forms.add(`${b}es`);
  else if (/[^aeiou]y$/.test(b)) forms.add(`${b.slice(0, -1)}ies`);
  else forms.add(`${b}s`);

  // past / past participle
  if (/[^aeiou]y$/.test(b)) forms.add(`${b.slice(0, -1)}ied`);
  else if (b.endsWith('e')) forms.add(`${b}d`);
  else forms.add(`${b}ed`);

  // present participle
  if (b.endsWith('ie')) forms.add(`${b.slice(0, -2)}ying`); // die -> dying
  else if (b.endsWith('e') && !b.endsWith('ee')) forms.add(`${b.slice(0, -1)}ing`);
  else forms.add(`${b}ing`);

  // doubled final consonant: CVC ending -> stab/stabbed/stabbing, gun/gunned
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(b)) {
    const doubled = b + b[b.length - 1];
    forms.add(`${doubled}ed`);
    forms.add(`${doubled}ing`);
  }
  return forms;
}

/** Build form -> {tier, category} index once, expanding every list lemma. */
function buildIndex() {
  const index = new Map();
  const add = (word, tier, category) => {
    for (const form of wordForms(word)) {
      if (!index.has(form)) index.set(form, { tier, category, base: word.toLowerCase() });
    }
  };
  for (const [category, words] of Object.entries(data.tier1_hardFail)) {
    for (const w of words) add(w, 1, category);
  }
  for (const [category, words] of Object.entries(data.tier2_review)) {
    for (const w of words) {
      // tier 1 wins if a form somehow collides
      const key = w.toLowerCase();
      if (!index.has(key) || index.get(key).tier !== 1) add(w, 2, category);
    }
  }
  return index;
}

const FORM_INDEX = buildIndex();
const PHRASES = (data.phrases_hardFail ?? []).map((p) => p.toLowerCase());

/**
 * Scans a single text blob. Returns unique hits:
 *   { term, matched, tier, category }
 * where `term` is the list base word and `matched` is the word as it appeared.
 */
export function scanText(text) {
  if (!text) return [];
  const hits = new Map();

  for (const token of tokenizeWords(text)) {
    const lower = token.toLowerCase().replace(/'/g, '');
    const entry = FORM_INDEX.get(lower);
    if (entry) {
      const key = `${entry.base}|${entry.tier}`;
      if (!hits.has(key)) {
        hits.set(key, { term: entry.base, matched: token, tier: entry.tier, category: entry.category });
      }
    }
  }

  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  for (const phrase of PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (re.test(normalized)) {
      const key = `${phrase}|phrase`;
      if (!hits.has(key)) hits.set(key, { term: phrase, matched: phrase, tier: 1, category: 'phrase' });
    }
  }

  return [...hits.values()];
}

/**
 * Collects every readable string in a story: title, summary, coverScene, and
 * for each level the sentence texts plus quiz questions and options.
 */
export function storyTextFragments(story) {
  const fragments = [];
  if (story.title) fragments.push({ where: 'title', text: story.title });
  if (story.summary) fragments.push({ where: 'summary', text: story.summary });
  if (story.coverScene) fragments.push({ where: 'coverScene', text: story.coverScene });

  for (const [level, levelData] of Object.entries(story.levels ?? {})) {
    for (const p of levelData.paragraphs ?? []) {
      for (const s of p.sentences ?? []) {
        if (s.text) fragments.push({ where: `${level}/text`, text: s.text });
      }
    }
    for (const q of levelData.quiz ?? []) {
      if (q.q) fragments.push({ where: `${level}/quiz`, text: q.q });
      for (const opt of q.options ?? []) {
        if (opt) fragments.push({ where: `${level}/quiz-option`, text: opt });
      }
    }
  }
  return fragments;
}

/** Scans a whole story. Returns { tier1, tier2 } arrays of hit records. */
export function scanStory(story) {
  const tier1 = [];
  const tier2 = [];
  for (const { where, text } of storyTextFragments(story)) {
    for (const hit of scanText(text)) {
      const record = { where, term: hit.term, matched: hit.matched, category: hit.category };
      (hit.tier === 1 ? tier1 : tier2).push(record);
    }
  }
  return { tier1, tier2 };
}
