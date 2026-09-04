#!/usr/bin/env python3
"""
Vocab pipeline - AŞAMA 1 (deterministik): spaCy ile tokenizasyon + lemma + POS + çekim.
LLM YOK. Her hikayenin her seviyesindeki her cümleyi spaCy'den geçirir, kelime
token'larını (noktalama/boşluk atılır) çıkarır ve ara-çıktıyı cache'e yazar.

Kaçınılan: content/ ve content/v2/stories dosyalarına DOKUNULMAZ (yalnız OKUNUR).
Çıktı: pipeline/vocab/cache/annot/{storyId}.json  (git'e girmez)

Kullanım:
  annotate.py st-0001 st-0004 st-0150
"""
import json
import re
import sys
from pathlib import Path

import spacy

ROOT = Path(__file__).resolve().parents[2]
STORIES_DIR = ROOT / "content" / "v2" / "stories"
ANNOT_DIR = Path(__file__).resolve().parent / "cache" / "annot"

# Kelime akışı karşılaştırması için (validate ile AYNI regex): kesme işaretiyle
# birleşen harf dizileri tek kelime sayılır; tire/noktalama ayırıcıdır.
WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)*")


def is_clitic(tok) -> bool:
    """don't -> [do, n't], she's -> [she, 's]: kesme parçası önceki kelimeye yapışır."""
    t = tok.text
    return t.startswith("'") or t.startswith("’") or t.lower() in ("n't", "n’t")


def annotate_sentence(nlp, text: str):
    """Bir cümleyi tokenize et; kelime token'larını döndür (noktalama/boşluk atılır)."""
    doc = nlp(text)
    tokens = []
    for tok in doc:
        if tok.is_space or tok.is_punct:
            continue
        if is_clitic(tok):
            # Kesme parçası: önceki surface'e yapıştır (lemma/tag ana parçadan kalır).
            if tokens:
                tokens[-1]["surface"] += tok.text
            continue
        # Çekim için bağımlılık bağlamı: dep etiketi + bu token'ın yardımcı fiil
        # (aux/auxpass) çocuklarının lemma'ları (have/be) - VBN aktif/edilgen ve
        # VBG sürerlik/sıfat-fiil ayrımı bunlara dayanır.
        aux = [c.lemma_.lower() for c in tok.children if c.dep_ in ("aux", "auxpass")]
        tokens.append(
            {
                "surface": tok.text,
                "lemma": tok.lemma_.lower(),
                "pos": tok.pos_,
                "tag": tok.tag_,
                "dep": tok.dep_,
                "aux": aux,
                "is_stop": bool(tok.is_stop),
                "is_propn": tok.pos_ == "PROPN",
                "is_num": tok.pos_ == "NUM" or bool(tok.like_num),
            }
        )
    return tokens


def annotate_story(nlp, story_id: str):
    story_path = STORIES_DIR / f"{story_id}.json"
    if not story_path.exists():
        raise FileNotFoundError(f"story yok: {story_path}")
    story = json.loads(story_path.read_text(encoding="utf-8"))

    out_levels = {}
    total_tokens = 0
    for level, data in story["levels"].items():
        sentences = []
        for p_idx, para in enumerate(data["paragraphs"]):
            for s_idx, sent in enumerate(para["sentences"]):
                text = sent["text"]
                toks = annotate_sentence(nlp, text)
                total_tokens += len(toks)
                # Doğrulama ipucu: surface akışı cümle kelime akışıyla eşleşiyor mu?
                expected = [w.lower() for w in WORD_RE.findall(text)]
                actual = [w.lower() for w in WORD_RE.findall(" ".join(t["surface"] for t in toks))]
                sentences.append(
                    {
                        "p": p_idx,
                        "s": s_idx,
                        "text": text,
                        "tokens": toks,
                        "aligned": expected == actual,
                    }
                )
        out_levels[level] = {"sentences": sentences}

    return {"storyId": story_id, "levels": out_levels, "totalTokens": total_tokens}


def main():
    args = sys.argv[1:]
    if args == ["--all"]:
        ids = sorted(p.stem for p in STORIES_DIR.glob("*.json"))
    else:
        ids = args
    if not ids:
        print("kullanım: annotate.py <storyId> [storyId...]  |  annotate.py --all", file=sys.stderr)
        sys.exit(1)

    ANNOT_DIR.mkdir(parents=True, exist_ok=True)
    print("spaCy modeli yükleniyor (en_core_web_sm)...")
    nlp = spacy.load("en_core_web_sm")

    for story_id in ids:
        result = annotate_story(nlp, story_id)
        out_path = ANNOT_DIR / f"{story_id}.json"
        out_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        levels = list(result["levels"].keys())
        n_sent = sum(len(l["sentences"]) for l in result["levels"].values())
        n_misalign = sum(
            1 for l in result["levels"].values() for s in l["sentences"] if not s["aligned"]
        )
        print(
            f"  {story_id}: {len(levels)} seviye, {n_sent} cümle, "
            f"{result['totalTokens']} token, hizalama-hatası={n_misalign} -> {out_path.name}"
        )


if __name__ == "__main__":
    main()
