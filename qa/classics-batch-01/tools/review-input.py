#!/usr/bin/env python3
"""Kor inceleme girdisi: hikayenin YALNIZ okur metni (baslik, 5 seviye, quiz).
Kaynak bilgisi, yazar notu, kapi sonucu YOK. Cikti: reviews/input/<id>-r<tur>.md

Kullanim: python3 qa/classics-batch-01/tools/review-input.py <tur> st-0273 [...]
"""
import json
import sys
from pathlib import Path

QA = Path(__file__).resolve().parent.parent
V2 = QA.parents[1] / "content" / "v2" / "stories"


def main():
    rnd = sys.argv[1]
    out = QA / "reviews" / "input"
    out.mkdir(parents=True, exist_ok=True)
    for sid in sys.argv[2:]:
        s = json.loads((V2 / f"{sid}.json").read_text())
        lines = [f"# {s['title']}", "", f"Summary: {s['summary']}", ""]
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
