#!/usr/bin/env node
/**
 * Harici üretilmiş kapak görsellerini (PNG/JPEG) içeri alır, webp'e işler
 * (3:4, 900x1200, ~300KB üst sınır) ve content/covers/ altına <id>.webp yazar.
 *
 * KAYNAK-GÜDÜMLÜ: index.json değil, KAYNAK klasördeki dosyalar üzerinden döner.
 * Böylece "50 mevcut + 150 yeni" bölünmesinde yalnız kaynaktakiler işlenir,
 * mevcut kapaklara dokunulmaz. Kaynak dosya adı geçerli bir story id olmalı
 * (content/stories/<id>.json var olmalı); olmayanlar atlanır ve raporlanır.
 *
 * Not: Gemini bazen JPEG içeriği .png uzantısıyla üretir; sharp içeriği
 * otomatik algılar, uzantı önemli değil. Farklı kaynak boyutları (Gemini
 * ~1696x2528, ChatGPT 1024x1536) tek tip 900x1200'e (fit: cover) getirilir.
 *
 * Kullanım:
 *   node pipeline/import-covers.mjs [--src <klasör>] [--check]
 *   --check : yalnız eşleştirme/rapor (yazma yok)
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { STORIES_DIR, COVERS_DIR } from './lib/env.mjs';

const DEFAULT_SRC =
  '/Users/mustafa.aksit/Documents/AiProjects/gemini-auto-create-script/output/lymia-kapak';
const srcArgIdx = process.argv.indexOf('--src');
const SRC = srcArgIdx !== -1 ? process.argv[srcArgIdx + 1] : DEFAULT_SRC;
const CHECK_ONLY = process.argv.includes('--check');

const OUT_W = 900;
const OUT_H = 1200; // 3:4 dikey — mevcut 50 kapakla (generate-cover.mjs) tutarlı
const MAX_BYTES = 300 * 1024;

if (!existsSync(SRC)) {
  console.error(`Kaynak klasör yok: ${SRC}`);
  process.exit(1);
}

const storyIds = new Set(
  readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, '')),
);

const IMG_RE = /\.(png|jpe?g|webp)$/i;
const srcFiles = readdirSync(SRC).filter((f) => IMG_RE.test(f));

const items = []; // { id, file }
const orphan = []; // kaynakta var, hikaye yok
for (const file of srcFiles) {
  const id = file.replace(IMG_RE, '');
  if (storyIds.has(id)) items.push({ id, file });
  else orphan.push(file);
}

// Aynı id için birden çok kaynak dosya varsa uyar (deterministik: ilk alfabetik).
const byId = new Map();
for (const it of items) {
  if (!byId.has(it.id)) byId.set(it.id, it.file);
}
const dupes = items.length - byId.size;

console.log(`kaynak: ${SRC}`);
console.log(`kaynak görsel: ${srcFiles.length} | eşleşen (story id): ${byId.size}` +
  `${dupes ? ` | mükerrer atlanan: ${dupes}` : ''}`);
console.log(`ORPHAN (kaynakta var, hikaye yok): ${orphan.length ? orphan.join(', ') : 'yok'}`);

// Hangi hikayelerde hâlâ kapak yok (ne mevcut webp ne bu kaynak)?
const haveWebp = new Set(
  readdirSync(COVERS_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')),
);
const stillMissing = [...storyIds].filter((id) => !haveWebp.has(id) && !byId.has(id)).sort();
console.log(`bu import sonrası hâlâ kapaksız: ${stillMissing.length ? stillMissing.join(', ') : 'yok'}`);

if (CHECK_ONLY) {
  process.exit(orphan.length === 0 ? 0 : 1);
}

console.log('\n=== işleme ===');
let count = 0;
let totalBytes = 0;
const kb = [];
const ids = [...byId.keys()].sort();
for (const id of ids) {
  const inPath = path.join(SRC, byId.get(id));
  const outPath = path.join(COVERS_DIR, `${id}.webp`);
  let quality = 82;
  let out = await sharp(inPath).resize(OUT_W, OUT_H, { fit: 'cover' }).webp({ quality }).toBuffer();
  while (out.length > MAX_BYTES && quality > 58) {
    quality -= 6;
    out = await sharp(inPath).resize(OUT_W, OUT_H, { fit: 'cover' }).webp({ quality }).toBuffer();
  }
  writeFileSync(outPath, out);
  count++;
  totalBytes += out.length;
  kb.push(Math.round(out.length / 1024));
  if (count % 10 === 0 || count === ids.length) {
    console.log(`  ${count}/${ids.length} işlendi (son: ${id}, ${Math.round(out.length / 1024)}KB q${quality})`);
  }
}

console.log(`\nBitti: ${count}/${ids.length} kapak yazıldı → content/covers/`);
if (count) {
  console.log(`Toplam: ${(totalBytes / 1024 / 1024).toFixed(2)}MB | ort ${Math.round(totalBytes / count / 1024)}KB | min ${Math.min(...kb)}KB / max ${Math.max(...kb)}KB`);
}
