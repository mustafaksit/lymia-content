#!/usr/bin/env python3
"""Kor inceleme girdisi: hikayenin YALNIZ okur metni (baslik, 5 seviye, quiz).
Kaynak bilgisi, yazar notu, kapi sonucu YOK. Cikti: reviews/input/<id>-r<tur>.md

Kullanim: CLASSICS_BATCH=qa/classics-batch-NN python3 pipeline/classics/review-input.py <tur> st-XXXX [...]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from batch import V2 as _V2, batch_dir  # noqa: E402

QA = batch_dir()
V2 = _V2 / "stories"
SOURCES = json.loads((_V2 / "sources.json").read_text()).get("stories", {})


def main():
    rnd = sys.argv[1]
    out = QA / "reviews" / "input"
    out.mkdir(parents=True, exist_ok=True)
    for sid in sys.argv[2:]:
        s = json.loads((V2 / f"{sid}.json").read_text())
        lines = [f"# {s['title']}", "", f"Summary: {s['summary']}", ""]
        # Kriter 7 (A1 anlasilirlik) icin sozlukte aciklanmis sayilan anahtar kelimeler.
        key = SOURCES.get(sid, {}).get("keyTerms", [])[:5]
        if key:
            lines += [f"Glossed key words (A1/A2): {', '.join(key)}", ""]
        for lvl, lv in s["levels"].items():
            lines += [f"## Level {lvl}", ""]
            for p in lv["paragraphs"]:
                lines += [" ".join(x["text"] for x in p["sentences"]), ""]
            lines += [f"### Quiz ({lvl})", ""]
            for i, q in enumerate(lv["quiz"], 1):
                opts = " / ".join(f"{'*' if j == q['answer'] else ''}{o}" for j, o in enumerate(q["options"]))
                lines.append(f"{i}. {q['q']} — {opts}   (* = keyed answer)")
            lines.append("")
        (out / f"{sid}-r{rnd}.md").write_text("\n".join(lines))
        print(out / f"{sid}-r{rnd}.md")


if __name__ == "__main__":
    main()
