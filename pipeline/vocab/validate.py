#!/usr/bin/env python3
"""
Vocab pipeline v2 - DOĞRULAMA. Yeni format:
  content/v2/vocab/senses.json  -> { vocabVersion, senses: [ {id, lemma, pos, ...} ] }
  content/v2/vocab/{id}.json    -> { levels: { LV: { sentences: [ {p,s,tokens:[[surface,idx,tag]]} ] } } }

Her hikaye dosyası için:
  - seviye kümesi story JSON ile birebir eşleşir,
  - her cümle için p/s var ve story'de o indekste cümle mevcut,
  - token surface akışı cümle kelime akışıyla (noktalama hariç) SIRA+SAYI eşleşir,
  - her token indeksi -1 (yok) ya da 0 <= idx < len(senses).

content/ ve stories'e DOKUNULMAZ (yalnız okunur).
Kullanım: validate.py st-0001 ...   (argsız: vocab/ içindeki tüm {storyId}.json)
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


def load_senses():
    p = VOCAB_DIR / "senses.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8")).get("senses", [])


def validate_story(story_id: str, n_senses: int):
    errors = []
    vpath = VOCAB_DIR / f"{story_id}.json"
    spath = STORIES_DIR / f"{story_id}.json"
    if not vpath.exists():
        return [f"vocab dosyası yok: {vpath.name}"]
    if not spath.exists():
        return [f"story dosyası yok: {spath.name}"]

    vocab = json.loads(vpath.read_text(encoding="utf-8"))
    story = json.loads(spath.read_text(encoding="utf-8"))

    v_levels = set(vocab.get("levels", {}).keys())
    s_levels = set(story.get("levels", {}).keys())
    if v_levels != s_levels:
        errors.append(f"seviye uyuşmazlığı: vocab={sorted(v_levels)} story={sorted(s_levels)}")

    for level in sorted(v_levels & s_levels):
        s_paras = story["levels"][level]["paragraphs"]
        v_sents = vocab["levels"][level]["sentences"]
        s_map = {}
        for p_idx, para in enumerate(s_paras):
            for s_idx, sent in enumerate(para["sentences"]):
                s_map[(p_idx, s_idx)] = sent["text"]
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
                    f"(story={len(expected)}, vocab={len(actual)})"
                )
            for tok in vs["tokens"]:
                idx = tok[1]
                if idx != -1 and not (0 <= idx < n_senses):
                    errors.append(f"{level} p{vs['p']}s{vs['s']}: geçersiz sense indeksi {idx} (sınır {n_senses})")
        missing = set(s_map.keys()) - seen
        if missing:
            errors.append(f"{level}: {len(missing)} cümle vocab'da eksik (ör. {sorted(missing)[:3]})")

    return errors


def main():
    senses = load_senses()
    if senses is None:
        print("senses.json yok - önce build çalıştırın.")
        sys.exit(2)
    n = len(senses)
    print(f"senses.json: {n} anlam")

    ids = sys.argv[1:]
    if not ids:
        ids = sorted(p.stem for p in VOCAB_DIR.glob("*.json") if p.stem != "senses")

    ok = 0
    for story_id in ids:
        errors = validate_story(story_id, n)
        if errors:
            print(f"✗ {story_id}: GEÇERSİZ ({len(errors)} hata)")
            for e in errors[:20]:
                print(f"    - {e}")
        else:
            ok += 1
            print(f"✓ {story_id}: geçerli")
    print(f"\nSonuç: {ok}/{len(ids)} dosya geçerli.")
    sys.exit(0 if ok == len(ids) else 2)


if __name__ == "__main__":
    main()
