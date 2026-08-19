/**
 * Baslik tekrar esiklerinin regresyon testi (IS 1b).
 * Sebep: yayindaki katalogda 5 kumede BIREBIR AYNI baslik cikmisti; bu esikler
 * o tekrarin yeniden dogmasini engeller. node --test ile kosar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findTitleCollision, jaccard, titleKeywords, SOFT_THRESHOLD, HARD_THRESHOLD } from './title-similarity.mjs';

const others = [
  { id: 'st-0023', title: 'The Lost City' },
  { id: 'st-0088', title: 'The Library Note' },
  { id: 'st-0106', title: 'The Starship Garden' },
];

test('exact baslik -> exact cakisma (buyuk/kucuk harf duyarsiz)', () => {
  const hit = findTitleCollision('the LOST city', others);
  assert.equal(hit.level, 'exact');
  assert.equal(hit.otherId, 'st-0023');
});

test('cok yakin baslik -> hard cakisma', () => {
  // "The Library Notes" vs "The Library Note": kelime kumesi {library,note(s)}
  const hit = findTitleCollision('The Library Note Book', others);
  assert.ok(hit, 'cakisma bekleniyor');
  assert.ok(hit.jaccard >= SOFT_THRESHOLD);
});

test('ozgun baslik -> cakisma yok', () => {
  assert.equal(findTitleCollision('A Letter from Someone Lonely', others), null);
  assert.equal(findTitleCollision('The Signal in the Dark', others), null);
});

test('kendini atlar (selfId)', () => {
  const withSelf = [...others, { id: 'me', title: 'The Lost City' }];
  assert.equal(findTitleCollision('The Lost City', withSelf, 'me').otherId, 'st-0023');
});

test('titleKeywords stopword ve kisa kelimeleri atar', () => {
  assert.deepEqual([...titleKeywords('The Key to the Old Map')].sort(), ['key', 'map', 'old']);
});

test('esik sabitleri beklendigi gibi', () => {
  assert.equal(SOFT_THRESHOLD, 0.5);
  assert.equal(HARD_THRESHOLD, 0.6);
  assert.equal(jaccard(new Set(['a','b']), new Set(['a','b'])), 1);
});
