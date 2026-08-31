// Yayın filtresi: story JSON'lardan YAYINLANMAYAN seviye anahtarlarını atar.
//
// NEDEN: Pipeline her hikaye için C1 de üretir (gelecekteki App 1.1 için), ama
// yayınlanan set LEVELS (A1-B2) ile sınırlıdır ve app'in zod şeması
// (z.enum(['A1','A2','B1','B2'])) fazla anahtarı (C1) REDDEDER → hikaye "boş"
// görünür. Bu yüzden yayına çıkan story JSON'ında LEVELS dışı seviye BULUNMAMALI.
//
// Bu filtre build-index'in başında çağrılır → C1 (veya ileride başka bir yayın-dışı
// seviye) bir daha yayına sızamaz. Idempotent: yalnız değişen dosyayı yazar.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * @param {object} opts
 * @param {string} opts.storiesDir  content/stories dizini
 * @param {readonly string[]} opts.levels  yayınlanan seviyeler (izinli anahtarlar)
 * @returns {{ changedFiles: number, removedKeys: number, details: string[] }}
 */
export function stripUnpublishedLevels({ storiesDir, levels }) {
  const allow = new Set(levels);
  const files = readdirSync(storiesDir).filter((f) => f.endsWith('.json'));
  let changedFiles = 0;
  let removedKeys = 0;
  const details = [];
  for (const f of files) {
    const p = path.join(storiesDir, f);
    const story = JSON.parse(readFileSync(p, 'utf8'));
    if (!story.levels || typeof story.levels !== 'object') continue;
    const extra = Object.keys(story.levels).filter((k) => !allow.has(k));
    if (extra.length === 0) continue;
    for (const k of extra) delete story.levels[k];
    writeFileSync(p, JSON.stringify(story, null, 2) + '\n');
    changedFiles++;
    removedKeys += extra.length;
    details.push(`${story.id ?? f}: ${extra.join(',')}`);
  }
  return { changedFiles, removedKeys, details };
}
