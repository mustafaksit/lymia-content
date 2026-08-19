#!/usr/bin/env node
/**
 * Katalog saglik taramasi. Her hikaye-seviye icin: metin, ses(mp3), karaoke
 * timing, quiz(3), ozet, kapak, index kaydi ve gramer uyum hatasi. Eksik/sorun
 * isaretlenir. "Yayindaki katalog %100 saglam mi" sorusunun tek-tablo cevabi.
 * Salt-okunur; hicbir sey degistirmez.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { STORIES_DIR, CONTENT_DIR, AUDIO_DIR, COVERS_DIR } from './lib/env.mjs';
import { levelAgreementCount } from './lib/agreement.mjs';

const idx = JSON.parse(readFileSync(path.join(CONTENT_DIR, 'index.json'), 'utf8'));
const published = new Set(idx.stories.map((s) => s.id));
const files = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json')).sort();

const rows = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(path.join(STORIES_DIR, f), 'utf8'));
  const id = d.id;
  const levels = Object.keys(d.levels ?? {});
  let audioMiss = [], timingMiss = [], quizMiss = [], agr = 0;
  for (const lvl of levels) {
    const L = d.levels[lvl];
    const lc = lvl.toLowerCase();
    if (!existsSync(path.join(AUDIO_DIR, lc, `${id}.mp3`))) audioMiss.push(lvl);
    if (!existsSync(path.join(AUDIO_DIR, lc, `${id}.timings.json`))) timingMiss.push(lvl);
    // timing metin ile hizali mi (kelime sayisi)
    if (!Array.isArray(L.quiz) || L.quiz.length < 3) quizMiss.push(lvl);
    agr += levelAgreementCount(L);
  }
  rows.push({
    id, pub: published.has(id), levels: levels.length,
    summary: !!(d.summary && d.summary.trim()),
    cover: existsSync(path.join(COVERS_DIR, `${id}.webp`)),
    audioMiss, timingMiss, quizMiss, agr,
  });
}

const mark = (ok) => (ok ? 'ok' : 'EKSIK');
console.log('id       | yayin | sev | ozet | kapak | ses | timing | quiz | gramer');
console.log('---------|-------|-----|------|-------|-----|--------|------|-------');
let clean = 0;
for (const r of rows) {
  const healthy = r.levels === 5 && r.summary && r.cover && !r.audioMiss.length && !r.timingMiss.length && !r.quizMiss.length && r.agr === 0;
  if (healthy) clean++;
  console.log(
    `${r.id} | ${r.pub ? 'LIVE' : 'yeni'}  | ${r.levels}/5 | ${mark(r.summary)} | ${mark(r.cover)} | ` +
    `${r.audioMiss.length ? r.audioMiss.join(',') : 'ok'} | ${r.timingMiss.length ? r.timingMiss.join(',') : 'ok'} | ` +
    `${r.quizMiss.length ? r.quizMiss.join(',') : 'ok'} | ${r.agr === 0 ? 'temiz' : r.agr + ' hata'}`,
  );
}
const liveRows = rows.filter((r) => r.pub);
const liveAgr = liveRows.filter((r) => r.agr > 0).length;
const liveCover = liveRows.filter((r) => !r.cover).length;
console.log('\n=== OZET ===');
console.log(`Toplam ${rows.length} hikaye (${liveRows.length} yayinda, ${rows.length - liveRows.length} yeni)`);
console.log(`Tam saglam (5 seviye + ozet + kapak + ses + timing + quiz + gramer temiz): ${clean}/${rows.length}`);
console.log(`Yayindaki ${liveRows.length}: gramer hatasi olan ${liveAgr}, kapagi eksik ${liveCover}`);
console.log(`Toplam gramer uyum hatasi (tum katalog): ${rows.reduce((n, r) => n + r.agr, 0)}`);
