#!/usr/bin/env node
/**
 * content/v2/ üretir — YENİ app'in (build 12+) okuduğu 5-seviyeli (A1-C1) katalog.
 * ESKİ build 9 için content/index.json + content/stories/ AYNEN KALIR; bu script
 * onlara DOKUNMAZ (yalnız content/v2/ altına yazar). Böylece C1 yayınlanır ama
 * eski app'in gördüğü hiçbir dosya değişmez → build 9 kırılmaz.
 *
 * v2/stories: 5-seviye (C1 dahil), C1-strip ÖNCESİ commit'ten (SOURCE_COMMIT) alınır.
 * v2/covers:  İÇERİK-HASH'Lİ dosya adı (st-XXXX-<hash8>.webp) → ?v yerine gerçek yeni
 *             yol; kapak değişince ad değişir, jsDelivr/expo-image cache sorunu biter.
 * ses:        ORTAK (content/audio/, c1 dahil) — kopyalanmaz; app AUDIO_BASE'den okur.
 * contentVersion: v1'in ÜSTÜNDE ayrı sayaç (cihaz MMKV karşılaştırması v2'yi cache'lesin).
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

import { REPO_ROOT, CONTENT_DIR, STORIES_DIR, COVERS_DIR } from './lib/env.mjs';
import { levelWordCount } from './lib/validate.mjs';

const SOURCE_COMMIT = process.env.V2_SOURCE_COMMIT || '7ed0202'; // C1-strip ÖNCESİ (5-seviye)
const V2_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const V2_DIR = path.join(CONTENT_DIR, 'v2');
const V2_STORIES = path.join(V2_DIR, 'stories');
const V2_COVERS = path.join(V2_DIR, 'covers');
mkdirSync(V2_STORIES, { recursive: true });
mkdirSync(V2_COVERS, { recursive: true });

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function minutesFor(wc) {
  return Math.max(1, Math.round(wc / 128));
}

const ids = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();

// v1 index'ten adConfig + order + isNew referansları (v1 dosyasına DOKUNMADAN, sadece okuma).
const v1 = JSON.parse(readFileSync(path.join(CONTENT_DIR, 'index.json'), 'utf8'));
const v1Order = new Map(v1.stories.map((s) => [s.id, s.order]));

const prevV2 = existsSync(path.join(V2_DIR, 'index.json'))
  ? JSON.parse(readFileSync(path.join(V2_DIR, 'index.json'), 'utf8'))
  : null;
const prevV2Ids = new Set(prevV2?.stories?.map((s) => s.id) ?? []);
// v1'in ÜSTÜNDE başlat → cihazdaki MMKV localVersion (en fazla v1=24) < v2 → v2 cache'lenir.
const contentVersion = prevV2 ? prevV2.contentVersion + 1 : v1.contentVersion + 1;

const stories = ids.map((id, i) => {
  // 5-seviye story: C1-strip ÖNCESİ commit'ten (güncel A1-B2 + C1 = birebir).
  const raw = execSync(`git show ${SOURCE_COMMIT}:content/stories/${id}.json`, {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const story = JSON.parse(raw);
  writeFileSync(path.join(V2_STORIES, `${id}.json`), JSON.stringify(story, null, 2) + '\n');

  // Kapak: içerik-hash'li ad (mevcut content/covers/<id>.webp'ten kopya; redo 20 dahil).
  const coverBuf = readFileSync(path.join(COVERS_DIR, `${id}.webp`));
  const hash = crypto.createHash('sha256').update(coverBuf).digest('hex').slice(0, 8);
  const coverName = `${id}-${hash}.webp`;
  copyFileSync(path.join(COVERS_DIR, `${id}.webp`), path.join(V2_COVERS, coverName));

  const levels = V2_LEVELS.filter((l) => story.levels[l]);
  const wordCount = {};
  const minutes = {};
  for (const l of levels) {
    wordCount[l] = levelWordCount(story.levels[l]);
    minutes[l] = minutesFor(wordCount[l]);
  }
  return {
    id: story.id,
    slug: slugify(story.title),
    title: story.title,
    ...(typeof story.summary === 'string' && story.summary.trim() ? { summary: story.summary.trim() } : {}),
    genre: story.genre,
    levels,
    wordCount,
    minutes,
    cover: `covers/${coverName}`, // v2 köküne göre, ?v YOK (hash cache-bust)
    isNew: prevV2 ? !prevV2Ids.has(story.id) : false,
    order: v1Order.get(story.id) ?? i + 1,
  };
});

const index = {
  schemaVersion: 1,
  contentVersion,
  updatedAt: new Date().toISOString().slice(0, 10),
  adConfig: v1.adConfig,
  stories,
};
writeFileSync(path.join(V2_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');

const c1Count = stories.filter((s) => s.levels.includes('C1')).length;
console.log(`content/v2/index.json yazıldı: contentVersion ${contentVersion}, ${stories.length} hikaye, ${c1Count} C1'li`);
console.log(`v2/stories: ${ids.length} (5-seviye, kaynak ${SOURCE_COMMIT}) | v2/covers: ${ids.length} (hash'li)`);
