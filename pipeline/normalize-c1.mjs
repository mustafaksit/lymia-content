#!/usr/bin/env node
/**
 * C1 metinlerindeki tipografik ASCII-dışı noktalamayı düz ASCII'ye çevirir.
 * LLM'ler talimata rağmen akıllı tırnak / em-en tire / üç nokta üretebiliyor;
 * bu deterministik geçiş katalog genelinde tutarlılık sağlar. SADECE C1
 * seviyesine dokunur (A1-B2 mevcut/gönderilmiş içerik değişmez).
 *
 * Kullanım:
 *   node pipeline/normalize-c1.mjs            # tüm hikayeler
 *   node pipeline/normalize-c1.mjs --check    # sadece raporla, yazma
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { STORIES_DIR } from './lib/env.mjs';

const MAP = [
  [/[‘’‚‛]/g, "'"], // ' ' ‚ ‛ -> '
  [/[“”„‟]/g, '"'], // " " „ ‟ -> "
  [/[–—‑−]/g, '-'], // – — ‑ − -> -
  [/…/g, '...'], // … -> ...
  [/ /g, ' '], // non-breaking space -> space
  [/​/g, ''], // zero-width space -> (sil)
];

function normalize(str) {
  let out = str;
  for (const [re, rep] of MAP) out = out.replace(re, rep);
  // Latin diyakritiklerini katla (é->e, ç->c, ï->i ...). Tokenizer yalnız
  // [A-Za-z] tanıdığı için aksanlı harf kelimeyi bölerdi; İngilizce okuyucu
  // için ASCII karşılığı güvenli ("café"->"cafe", "façade"->"facade").
  out = out.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  return out;
}

const check = process.argv.includes('--check');

function run() {
  const files = readdirSync(STORIES_DIR).filter((f) => /^st-\d{4}\.json$/.test(f)).sort();
  let changed = 0;
  const remaining = [];
  for (const f of files) {
    const p = path.join(STORIES_DIR, f);
    const story = JSON.parse(readFileSync(p, 'utf8'));
    const c1 = story.levels?.C1;
    if (!c1) continue;

    let touched = false;
    for (const para of c1.paragraphs) {
      for (const s of para.sentences) {
        const n = normalize(s.text);
        if (n !== s.text) { s.text = n; touched = true; }
      }
    }
    for (const q of c1.quiz ?? []) {
      const nq = normalize(q.q);
      if (nq !== q.q) { q.q = nq; touched = true; }
      q.options = q.options.map((o) => {
        const no = normalize(o);
        if (no !== o) touched = true;
        return no;
      });
    }

    if (touched) {
      changed++;
      if (!check) writeFileSync(p, JSON.stringify(story, null, 2) + '\n');
    }
    // kalan ASCII-dışı (isim aksanı vb.) raporu
    const joined = c1.paragraphs.flatMap((pp) => pp.sentences.map((s) => s.text)).join(' ');
    const leftover = [...new Set(joined.match(/[^\x00-\x7F]/g) ?? [])];
    if (leftover.length) remaining.push(`${story.id}: ${leftover.join(' ')}`);
  }
  console.log(`${check ? '[check] ' : ''}normalize edilen C1: ${changed}`);
  if (remaining.length) {
    console.log(`kalan ASCII-dışı karakterler (aksanlı harf vb., dokunulmadı):`);
    for (const r of remaining) console.log(`  ${r}`);
  } else {
    console.log('kalan ASCII-dışı karakter yok.');
  }
}

run();
