#!/usr/bin/env python3
"""
Vocab pipeline - DOĞRULAMA. Her content/v2/vocab/{id}.json dosyasını kaynak
content/v2/stories/{id}.json ile karşılaştırır:
  - seviye kümesi story ile birebir eşleşir,
  - her cümle için p/s var ve story'de o indekste cümle mevcut,
  - token surface'leri birleştirilince cümlenin kelime akışıyla (noktalama hariç)
    SIRA ve SAYI olarak eşleşir,
  - her token'ın senseId'si ya null ya da senses sözlüğünde tanımlı.

Uyumsuzluk varsa dosya "GEÇERSİZ" işaretlenir (yayınlanmamalı) ve hata yazılır.
content/ ve stories dosyalarına DOKUNULMAZ (yalnız okunur).

Kullanım: validate.py st-0001 st-0004 st-0150   (argsız: vocab/ içindeki tümü)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORIES_DIR = ROOT / "content" / "v2" / "stories"
VOCAB_DIR = ROOT / "content" / "v2" / "vocab"

WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)*")


def words_of(text: str):
    return [w.lower() for w in WORD_RE.findall(text)]


def validate_story(story_id: str):
    errors = []
    vpath = VOCAB_DIR / f"{story_id}.json"
    spath = STORIES_DIR / f"{story_id}.json"
    if not vpath.exists():
        return [f"vocab dosyası yok: {vpath.name}"]
    if not spath.exists():
        return [f"story dosyası yok: {spath.name}"]

    vocab = json.loads(vpath.read_text(encoding="utf-8"))
    story = json.loads(spath.read_text(encoding="utf-8"))
    senses = vocab.get("senses", {})

    # 1) seviye kümesi eşleşir
    v_levels = set(vocab.get("levels", {}).keys())
    s_levels = set(story.get("levels", {}).keys())
    if v_levels != s_levels:
        errors.append(f"seviye uyuşmazlığı: vocab={sorted(v_levels)} story={sorted(s_levels)}")

    for level in sorted(v_levels & s_levels):
        s_paras = story["levels"][level]["paragraphs"]
        v_sents = vocab["levels"][level]["sentences"]
        # story'deki (p,s) -> text haritası
        s_map = {}
        for p_idx, para in enumerate(s_paras):
            for s_idx, sent in enumerate(para["sentences"]):
                s_map[(p_idx, s_idx)] = sent["text"]
        # her vocab cümlesi için hizalama
        seen = set()
        for vs in v_sents:
            key = (vs["p"], vs["s"])
            if key not in s_map:
                errors.append(f"{level} p{vs['p']}s{vs['s']}: story'de böyle bir cümle yok")
                continue
            seen.add(key)
            expected = words_of(s_map[key])
            surfaces = [tok[0] for tok in vs["tokens"]]
            actual = words_of(" ".join(surfaces))
            if expected != actual:
                errors.append(
                    f"{level} p{vs['p']}s{vs['s']}: kelime akışı uyuşmuyor "
                    f"(story={len(expected)} tok, vocab={len(actual)} tok)"
                )
            # senseId geçerliliği
            for tok in vs["tokens"]:
                sid = tok[1]
                if sid is not None and sid not in senses:
                    errors.append(f"{level} p{vs['p']}s{vs['s']}: tanımsız senseId '{sid}'")
        # story'de olup vocab'da olmayan cümle var mı
        missing = set(s_map.keys()) - seen
        if missing:
            errors.append(f"{level}: {len(missing)} cümle vocab'da eksik (ör. {sorted(missing)[:3]})")

    return errors


def main():
    ids = sys.argv[1:]
    if not ids:
        ids = sorted(p.stem for p in VOCAB_DIR.glob("*.json"))
    if not ids:
        print("vocab/ boş, doğrulanacak dosya yok.")
        return

    total_ok = 0
    for story_id in ids:
        errors = validate_story(story_id)
        if errors:
            print(f"✗ {story_id}: GEÇERSİZ ({len(errors)} hata)")
            for e in errors[:20]:
                print(f"    - {e}")
        else:
            total_ok += 1
            print(f"✓ {story_id}: geçerli")
    print(f"\nSonuç: {total_ok}/{len(ids)} dosya geçerli.")
    sys.exit(0 if total_ok == len(ids) else 2)


if __name__ == "__main__":
    main()
