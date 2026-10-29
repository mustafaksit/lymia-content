#!/usr/bin/env python3
"""Quiz siklarini deterministik karistirir (tohum: id+seviye+soru no), dogru cevabi korur.
Amac: dogru cevap konumu tahmin edilemesin (yazarlar bazen 0/1/2 sirasini sabit birakti).
Kullanim: python3 qa/classics-batch-01/tools/shuffle-quiz.py [st-0273 ...]  (bos: batch-ids.json)"""
import hashlib, json, random, sys
from pathlib import Path
QA = Path(__file__).resolve().parent.parent
V2 = QA.parents[1] / "content" / "v2" / "stories"
ids = sys.argv[1:] or json.loads((QA / "batch-ids.json").read_text())
for sid in ids:
    p = V2 / f"{sid}.json"
    s = json.loads(p.read_text())
    dist = [0, 0, 0]
    for lvl, lv in s["levels"].items():
        for i, q in enumerate(lv["quiz"]):
            correct = q["options"][q["answer"]]
            rng = random.Random(int(hashlib.sha256(f"{sid}|{lvl}|{i}".encode()).hexdigest(), 16))
            opts = q["options"][:]
            rng.shuffle(opts)
            q["options"], q["answer"] = opts, opts.index(correct)
            dist[q["answer"]] += 1
    p.write_text(json.dumps(s, ensure_ascii=False, indent=2) + "\n")
    print(sid, "answer dist", dist)
