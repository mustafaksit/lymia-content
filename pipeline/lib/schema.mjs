/**
 * Structural schema validation for a story JSON, independent of level rules.
 * Returns an array of error strings (empty = valid). Audio/wordTimings are
 * optional here (added by later pipeline stages); this checks the shape the
 * app relies on to render a story.
 */
import { ALL_LEVELS, GENRES } from './levels.mjs';

const ID_RE = /^st-\d{4}$/;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateSchema(story) {
  const errors = [];
  const push = (msg) => errors.push(msg);

  if (!isNonEmptyString(story.id)) push('id: missing or empty');
  else if (!ID_RE.test(story.id)) push(`id: "${story.id}" must match st-NNNN`);

  if (!isNonEmptyString(story.title)) push('title: missing or empty');
  if (!isNonEmptyString(story.summary)) push('summary: missing or empty');
  if (!isNonEmptyString(story.coverScene)) push('coverScene: missing or empty');

  if (!isNonEmptyString(story.genre)) push('genre: missing or empty');
  else if (!GENRES.includes(story.genre)) push(`genre: "${story.genre}" not in ${GENRES.join('/')}`);

  if (typeof story.levels !== 'object' || story.levels === null) {
    push('levels: missing object');
    return errors;
  }

  const levelKeys = Object.keys(story.levels);
  if (levelKeys.length === 0) push('levels: no levels present');

  for (const [level, levelData] of Object.entries(story.levels)) {
    if (!ALL_LEVELS.includes(level)) {
      push(`levels.${level}: unknown level (allowed: ${ALL_LEVELS.join('/')})`);
      continue;
    }
    const at = `levels.${level}`;

    if (!Array.isArray(levelData.paragraphs) || levelData.paragraphs.length === 0) {
      push(`${at}.paragraphs: missing or empty`);
    } else {
      levelData.paragraphs.forEach((p, pi) => {
        if (!Array.isArray(p.sentences) || p.sentences.length === 0) {
          push(`${at}.paragraphs[${pi}].sentences: missing or empty`);
          return;
        }
        p.sentences.forEach((s, si) => {
          if (!isNonEmptyString(s.text)) {
            push(`${at}.paragraphs[${pi}].sentences[${si}].text: missing or empty`);
          }
        });
      });
    }

    if (!Array.isArray(levelData.quiz) || levelData.quiz.length !== 3) {
      push(`${at}.quiz: must have exactly 3 questions`);
    } else {
      levelData.quiz.forEach((q, qi) => {
        const qat = `${at}.quiz[${qi}]`;
        if (!isNonEmptyString(q.q)) push(`${qat}.q: missing or empty`);
        if (!Array.isArray(q.options) || q.options.length !== 3) {
          push(`${qat}.options: must have exactly 3`);
        } else if (!q.options.every(isNonEmptyString)) {
          push(`${qat}.options: contains empty option`);
        }
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 2) {
          push(`${qat}.answer: must be integer 0-2`);
        }
      });
    }
  }

  return errors;
}
