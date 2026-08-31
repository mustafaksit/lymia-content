import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const D4='st-0008,st-0012,st-0013,st-0014,st-0020,st-0084,st-0091,st-0120,st-0121,st-0122,st-0124,st-0125,st-0126,st-0128,st-0133,st-0141,st-0148,st-0150,st-0154,st-0165,st-0169,st-0173,st-0186,st-0187,st-0209,st-0212,st-0215,st-0220,st-0228,st-0232,st-0238,st-0244,st-0252,st-0255,st-0268,st-0270,st-0271'.split(',');
const norm=x=>x.toLowerCase().replace(/\s+/g,' ').trim();
const g1=[],g2=[];
for(const id of D4){const s=JSON.parse(readFileSync(`${ROOT}/content/stories/${id}.json`,'utf8'));
 for(const[lvl,L]of Object.entries(s.levels)){const sents=L.paragraphs.flatMap(p=>p.sentences.map(x=>x.text.trim()));
  const freq=new Map();for(const t of sents)if(t.length>=25){const k=norm(t);if(!freq.has(k))freq.set(k,{c:0,t});freq.get(k).c++;}
  for(const{c,t}of freq.values()){if(c<2)continue;
   const quoted=/["“'']/.test(t)&&t.length<70; const many=c>=3; const longNarr=t.length>60&&!/["“]/.test(t);
   const rec={id,title:s.title,lvl,count:c,text:t};
   if(many||longNarr) g1.push(rec); else g2.push(rec);
  }}}
const fmt=r=>`- **${r.id}/${r.lvl}** (${r.count}×): ${r.text.slice(0,90)}${r.text.length>90?'…':''}`;
const L=['# D4 Triyaj — Paragraf/Cumle Tekrari','','> SADECE liste; hicbir sey silinmedi. Grup 1 onayinla duzeltilecek, Grup 2 korunacak.',''];
L.push(`## Grup 1 — Muhtemel kopya-paste bug (${g1.length} bulgu)`,'');L.push(...g1.map(fmt));
L.push('',`## Grup 2 — Muhtemel kasitli nakarat / dogal tekrar (${g2.length} bulgu)`,'');L.push(...g2.map(fmt));
writeFileSync(`${ROOT}/pipeline/d4-triage.md`,L.join('\n')+'\n');
console.log('Grup1(kopya-paste):',g1.length,'bulgu |',new Set(g1.map(r=>r.id)).size,'hikaye');
console.log('Grup2(nakarat):',g2.length,'bulgu |',new Set(g2.map(r=>r.id)).size,'hikaye');
console.log('\n-- Grup 1 örnekleri --');g1.slice(0,10).forEach(r=>console.log(fmt(r)));
console.log('\n-- Grup 2 örnekleri --');g2.slice(0,8).forEach(r=>console.log(fmt(r)));
