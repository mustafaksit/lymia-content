#!/usr/bin/env node
/**
 * content/v2/index.json icine batch hikayelerinin katalog girdilerini ekler/gunceller.
 * build-v2.mjs ile ayni alan kurallari (slug, wordCount=levelWordCount, minutes=wc/128).
 * contentVersion'a DOKUNMAZ (yayin ayri adim, kullanici onayiyla).
 * Kapak: v2/covers/ altinda <id>-<hash8>.webp varsa onu baglar; yoksa mevcut degeri korur
 * (ilk eklemede "covers/<id>-pending.webp": kapak otomasyonu + import-covers-v2.mjs bekleniyor).
 *
 * Kullanim: node qa/classics-batch-01/tools/index-add.mjs [st-0273 ...]   (bos: batch-ids.json)
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { levelWordCount } = await import(pathToFileURL(path.join(ROOT, 'pipeline/lib/validate.mjs')));
const V2 = path.join(ROOT, 'content/v2');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : JSON.parse(readFileSync(path.join(ROOT, 'qa/classics-batch-01/batch-ids.json'), 'utf8'));

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const minutesFor = (wc) => Math.max(1, Math.round(wc / 128));

const indexPath = path.join(V2, 'index.json');
// Paralel yazarlar ayni index.json'u guncelleyebilir: mkdir kilidi (atomik).
const LOCK = path.join(V2, '.index.lock');
for (let i = 0; ; i++) {
  try { mkdirSync(LOCK); break; } catch {
    if (i > 200) { console.error('index kilidi alinamadi: ' + LOCK); process.exit(1); }
    await new Promise((r) => setTimeout(r, 100));
  }
}
process.on('exit', () => { try { rmdirSync(LOCK); } catch {} });
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const covers = readdirSync(path.join(V2, 'covers'));
let maxOrder = Math.max(...index.stories.filter((s) => !ids.includes(s.id)).map((s) => s.order));

for (const id of ids) {
  const story = JSON.parse(readFileSync(path.join(V2, 'stories', `${id}.json`), 'utf8'));
  const levels = LEVELS.filter((l) => story.levels[l]);
  const wordCount = {};
  const minutes = {};
  for (const l of levels) {
    wordCount[l] = levelWordCount(story.levels[l]);
    minutes[l] = minutesFor(wordCount[l]);
  }
  const existing = index.stories.find((s) => s.id === id);
  const hashed = covers.find((f) => new RegExp(`^${id}-[0-9a-f]{8}\\.webp$`).test(f));
  const entry = {
    id,
    slug: slugify(story.title),
    title: story.title,
    summary: story.summary.trim(),
    genre: story.genre,
    levels,
    wordCount,
    minutes,
    cover: hashed ? `covers/${hashed}` : existing?.cover ?? `covers/${id}-pending.webp`,
    isNew: true,
    order: existing?.order ?? ++maxOrder,
  };
  if (existing) Object.assign(existing, entry);
  else index.stories.push(entry);
  console.log(`${id} ${entry.title} | ${levels.map((l) => `${l}:${wordCount[l]}`).join(' ')} | ${entry.cover}`);
}

writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`index.json: ${index.stories.length} hikaye, contentVersion ${index.contentVersion} (degismedi)`);
