#!/usr/bin/env node
/**
 * Gemini kapak otomasyonunun ciktisini v2 kataloguna alir (içerik-hash'li ad).
 *
 * Kaynak: gemini-auto-create-script/output/<job>/<id>.(png|jpg|webp)  (job: lymia-kapak)
 * Islem:  import-covers.mjs ile ayni isleme (900x1200 3:4, fit cover, webp <=300KB)
 *         -> content/v2/covers/<id>-<sha256[0:8]>.webp
 *         -> content/v2/index.json girdisinin `cover` alani bu yola baglanir
 *         -> ayni id'nin eski hash'li dosyasi silinir (yalniz degistiyse)
 * Yalniz content/v2/stories/<id>.json olan id'ler islenir. contentVersion'a DOKUNMAZ.
 *
 * Kullanim:
 *   node pipeline/import-covers-v2.mjs                       # varsayilan kaynak, tum eslesenler
 *   node pipeline/import-covers-v2.mjs --src <klasor> --ids st-0273,st-0274
 *   node pipeline/import-covers-v2.mjs --check               # yalniz eslestirme raporu
 */
import crypto from 'node:crypto';
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { CONTENT_DIR, REPO_ROOT } from './lib/env.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
};
const SRC = arg('--src') || path.resolve(REPO_ROOT, '../gemini-auto-create-script/output/lymia-kapak');
const ONLY = arg('--ids') ? new Set(arg('--ids').split(',')) : null;
const CHECK_ONLY = process.argv.includes('--check');

const V2 = path.join(CONTENT_DIR, 'v2');
const COVERS = path.join(V2, 'covers');
const OUT_W = 900;
const OUT_H = 1200;
const MAX_BYTES = 300 * 1024;
const IMG_RE = /\.(png|jpe?g|webp)$/i;

if (!existsSync(SRC)) {
  console.error(`Kaynak klasor yok: ${SRC}`);
  process.exit(1);
}

const indexPath = path.join(V2, 'index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const byId = new Map(index.stories.map((s) => [s.id, s]));

const sources = new Map();
for (const f of readdirSync(SRC).filter((x) => IMG_RE.test(x)).sort()) {
  const id = f.replace(IMG_RE, '');
  if (!sources.has(id)) sources.set(id, f);
}

const report = { imported: [], unchanged: [], skipped: [] };
for (const [id, file] of sources) {
  if (ONLY && !ONLY.has(id)) continue;
  if (!existsSync(path.join(V2, 'stories', `${id}.json`)) || !byId.has(id)) {
    report.skipped.push(`${file} (v2 hikayesi/katalog girdisi yok)`);
    continue;
  }
  if (CHECK_ONLY) {
    report.imported.push(`${id} <- ${file} (check)`);
    continue;
  }
  let quality = 82;
  let buf;
  for (;;) {
    buf = await sharp(path.join(SRC, file))
      .resize(OUT_W, OUT_H, { fit: 'cover', position: 'attention' })
      .webp({ quality })
      .toBuffer();
    if (buf.length <= MAX_BYTES || quality <= 50) break;
    quality -= 6;
  }
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const name = `${id}-${hash}.webp`;
  const entry = byId.get(id);
  if (entry.cover === `covers/${name}` && existsSync(path.join(COVERS, name))) {
    report.unchanged.push(id);
    continue;
  }
  writeFileSync(path.join(COVERS, name), buf);
  for (const old of readdirSync(COVERS)) {
    if (old !== name && new RegExp(`^${id}-[0-9a-f]{8}\\.webp$`).test(old)) unlinkSync(path.join(COVERS, old));
  }
  entry.cover = `covers/${name}`;
  report.imported.push(`${id} <- ${file} -> ${name} (${Math.round(buf.length / 1024)} KB, q${quality})`);
}

if (!CHECK_ONLY) writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`Alinan: ${report.imported.length}`);
report.imported.forEach((l) => console.log('  ' + l));
if (report.unchanged.length) console.log(`Degismeyen: ${report.unchanged.join(', ')}`);
if (report.skipped.length) {
  console.log(`Atlanan: ${report.skipped.length}`);
  report.skipped.forEach((l) => console.log('  ' + l));
}
const pending = index.stories.filter((s) => /-pending\.webp$/.test(s.cover)).map((s) => s.id);
console.log(pending.length ? `Kapagi bekleyen: ${pending.join(', ')}` : 'Bekleyen kapak yok.');
