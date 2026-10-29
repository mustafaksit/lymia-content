#!/usr/bin/env python3
"""Ses + timing kontrolu (her hikaye, her seviye).

- MP3 var mi, ffprobe suresi; son kelime bitisi ile sure farki (< 1.5 sn bekleniyor)
- metin kelimeleri (generate-audio.py ile ayni WORD_RE) ile timing kelimelerinin
  sira sira hizalanmasi: ilk sapma noktasi + toplam fark
- cumle audioStart/audioEnd: monoton artan, 0 olmayan, audioEnd <= sure
Cikti: qa/classics-batch-01/audio-check.json + stdout ozet. Hata varsa cikis kodu 1.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

QA = Path(__file__).resolve().parent.parent
ROOT = QA.parents[1]
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’]*")


def duration(mp3):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else None


def main():
    ids = sys.argv[1:] or json.loads((QA / "batch-ids.json").read_text())
    report, bad = {}, 0
    for sid in ids:
        s = json.loads((ROOT / "content/v2/stories" / f"{sid}.json").read_text())
        for lvl, lv in s["levels"].items():
            mp3 = ROOT / "content" / lv["audio"]
            tim = ROOT / "content" / lv["wordTimings"]
            r = {"mp3": mp3.exists(), "timings": tim.exists()}
            if not (r["mp3"] and r["timings"]):
                r["fail"] = "dosya eksik"
            else:
                d = duration(mp3)
                t = json.loads(tim.read_text())
                words = [w for x in lv["paragraphs"] for snt in x["sentences"] for w in WORD_RE.findall(snt["text"])]
                tw = [x["word"] for x in t]
                first = next((i for i, (a, b) in enumerate(zip(words, tw)) if a.lower().replace("’", "'").strip("'") != b.lower().replace("’", "'").strip("'")), None)
                sents = [snt for x in lv["paragraphs"] for snt in x["sentences"]]
                mono = all(sents[i]["audioStart"] <= sents[i + 1]["audioStart"] for i in range(len(sents) - 1))
                zero = sum(1 for x in sents if x["audioEnd"] <= 0)
                r.update({
                    "durationSec": round(d, 2), "lastWordEnd": t[-1]["end"], "tailGap": round(d - t[-1]["end"], 2),
                    "textWords": len(words), "timingWords": len(tw), "firstMismatch": None if first is None else
                    {"i": first, "text": words[max(0, first - 3): first + 3], "timing": tw[max(0, first - 3): first + 3]},
                    "monotonic": mono, "zeroSentences": zero, "sentences": len(sents),
                })
                fails = []
                if abs(r["tailGap"]) > 1.5:
                    fails.append(f"tail gap {r['tailGap']}s")
                if not mono:
                    fails.append("cumle zamanlari monoton degil")
                if zero:
                    fails.append(f"{zero} cumle zamansiz")
                if sents[-1]["audioEnd"] > d + 0.05:
                    fails.append("son cumle sureyi asiyor")
                if first is not None:
                    fails.append(f"kelime hizalama sapmasi @{first}: {r['firstMismatch']}")
                if fails:
                    r["fail"] = "; ".join(fails)
            report[f"{sid}/{lvl}"] = r
            if r.get("fail"):
                bad += 1
            print(f"{sid} {lvl}: {'OK ' if not r.get('fail') else 'XX '} {r.get('durationSec')}s "
                  f"{r.get('textWords')}/{r.get('timingWords')} w" + (f"  -> {r['fail']}" if r.get("fail") else ""))
    (QA / "audio-check.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"\n{len(report) - bad}/{len(report)} seviye temiz")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
