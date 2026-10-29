#!/usr/bin/env python3
"""Mevcut v2 katalogundan seviye bazli baseline olcer -> stats/baseline-v2.json.

Olculenler (seviye basina, hikaye-basi degerlerin dagilimi):
  - words: kelime sayisi (median/min/max/p10/p90)
  - sentLen: hikayenin medyan cumle uzunlugu (kelime)
  - zipf: hikayenin medyan wordfreq zipf degeri (ozel isimler haric)
  - lowZipfRatio: zipf < 3.5 kelime orani (ozel isimler haric)
Kullanim: pipeline/.venv/bin/python pipeline/classics/baseline.py [--ids st-0001,...]
"""
import json
import re
import statistics as st
import sys
from pathlib import Path

from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parents[2]
V2 = ROOT / "content" / "v2" / "stories"
LEVELS = ["A1", "A2", "B1", "B2", "C1"]
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’]*")


def sentences(level):
    return [s["text"] for p in level["paragraphs"] for s in p["sentences"]]


def proper_nouns(sents):
    """Cumle basi olmayan konumda buyuk harfle gecen ve hic kucuk harfle gecmeyen kelimeler."""
    caps, lower = set(), set()
    for s in sents:
        toks = WORD_RE.findall(s)
        for i, t in enumerate(toks):
            base = t.replace("’", "'").split("'")[0]
            if not base:
                continue
            if base[0].isupper():
                if i > 0:
                    caps.add(base)
            else:
                lower.add(base.lower())
    return {c for c in caps if c.lower() not in lower and c != "I"}


def level_metrics(level):
    sents = sentences(level)
    pn = proper_nouns(sents)
    words = []
    lens = []
    for s in sents:
        toks = WORD_RE.findall(s)
        lens.append(len(toks))
        words.extend(toks)
    content = [w for w in words if w.replace("’", "'").split("'")[0] not in pn]
    z = [zipf_frequency(w.lower().replace("’", "'"), "en") for w in content]
    return {
        "words": len(words),
        "sentLen": st.median(lens) if lens else 0,
        "zipf": round(st.median(z), 2) if z else 0,
        "lowZipfRatio": round(sum(1 for x in z if x < 3.5) / len(z), 4) if z else 0,
    }


def dist(vals):
    vals = sorted(vals)
    q = st.quantiles(vals, n=10) if len(vals) >= 10 else [vals[0]] * 9
    return {
        "median": round(st.median(vals), 3),
        "min": round(vals[0], 3),
        "max": round(vals[-1], 3),
        "p10": round(q[0], 3),
        "p90": round(q[-1], 3),
        "n": len(vals),
    }


def main():
    ids = None
    if "--ids" in sys.argv:
        ids = set(sys.argv[sys.argv.index("--ids") + 1].split(","))
    files = sorted(V2.glob("st-*.json"))
    per = {l: {"words": [], "sentLen": [], "zipf": [], "lowZipfRatio": []} for l in LEVELS}
    for f in files:
        story = json.loads(f.read_text())
        if ids and story["id"] not in ids:
            continue
        for l in LEVELS:
            lv = story["levels"].get(l)
            if not lv:
                continue
            m = level_metrics(lv)
            for k, v in m.items():
                per[l][k].append(v)
    out = {
        "source": "content/v2/stories",
        "stories": len(files) if not ids else len(ids),
        "method": "words/sentLen: WORD_RE token; zipf: wordfreq en, ozel isimler haric; lowZipfRatio: zipf<3.5 orani",
        "levels": {l: {k: dist(v) for k, v in per[l].items() if v} for l in LEVELS},
    }
    if ids:
        print(json.dumps(out, indent=2))
    else:
        (ROOT / "stats").mkdir(exist_ok=True)
        (ROOT / "stats" / "baseline-v2.json").write_text(json.dumps(out, indent=2) + "\n")
        for l in LEVELS:
            d = out["levels"][l]
            print(l, {k: (v["median"], v["min"], v["max"], v["p10"], v["p90"]) for k, v in d.items()})


if __name__ == "__main__":
    main()
