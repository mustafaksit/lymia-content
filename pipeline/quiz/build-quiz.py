"""
ADIM 4: Orkestrasyon + cikti + dogrulama + rapor.
  build-quiz.py --pilot          # 3 pilot hikayenin lemma'lari (varsayilan)
  build-quiz.py --all            # 200 hikaye
  build-quiz.py --stories a,b,c
Cikti: content/v2/quiz/index.json + {ilk-harf}.json (compact). data/ + model gitignore.
"""
import os
import re
import sys
import json
import time
import random
import argparse

from common import (
    MODEL_NAME, OUT_DIR, CACHE_DIR, MAX_SENTS_PER_LEMMA, MAX_STORY_ATTEMPTS, GATE_TOPK,
    GATE_TARGET_IN_TOPN, GATE_MIN_PROB, SENT_MIN_WORDS, SENT_MAX_WORDS,
    PROPN_MAX_RATIO, DISTRACTOR_MAX_PROB, DISTRACTOR_RATIO, ZIPF_WINDOW,
    MLM, build_inventory, story_ids, words_of,
)
from gate import gate
from sentences import story_sentences, build_tatoeba_index, tatoeba_sentences
from distractors import build_pool, pick_distractors

PILOT = ["st-0001", "st-0004", "st-0150"]
QUIZ_VERSION = 1
random.seed(42)

def shard_of(lemma):
    c = lemma[:1].lower()
    return c if c.isalpha() else "misc"

def blank(sentence, surface):
    return re.sub(r"\b" + re.escape(surface) + r"\b", "____", sentence, count=1)

def validate_question(q):
    opts = q["options"]
    if len(opts) != 4 or len(set(opts)) != 4:
        return "options != 4 farkli"
    if q["answer"] not in opts:
        return "answer options'ta yok"
    if q["sentence"].count("____") != 1:
        return "tek ____ degil"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--stories", type=str, default="")
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="test: ilk N lemma")
    ap.add_argument("--no-tatoeba", action="store_true")
    args = ap.parse_args()

    all_ids = story_ids()
    if args.all:
        target_stories = all_ids
    elif args.stories:
        target_stories = [s.strip() for s in args.stories.split(",")]
    else:
        target_stories = PILOT  # varsayilan pilot

    t0 = time.time()
    print(f"model: {MODEL_NAME} | hedef hikaye: {len(target_stories)}", flush=True)

    # Tam envanter (celdirici havuzu + hedef occ), hedef anahtarlar = pilot hikayelerde gecen
    inv = build_inventory(all_ids)
    pilot_set = set(target_stories)
    keys = [k for k, e in inv.items() if any(o["storyId"] in pilot_set for o in e["occ"])]
    keys.sort()
    if args.limit:
        keys = keys[: args.limit]
    print(f"tam envanter lemma|pos: {len(inv)} | hedef lemma|pos: {len(keys)}", flush=True)

    pool = build_pool(inv)
    mlm = MLM()

    tatoeba_index = None
    if not args.no_tatoeba:
        print("Tatoeba index (tek gecis)...", flush=True)
        tatoeba_index = build_tatoeba_index(set(keys), inv)

    # ---- Uretim ----
    shards = {}
    stats = {
        "storyGateAttempt": 0, "storyGatePass": 0, "storyGateRejects": [],
        "tatoebaClosed": 0, "zeroLemmas": [], "llmNeeded": [],
        "dist": {"0": 0, "1": 0, "2": 0, "3": 0},
        "noDistractor": [], "questions": 0,
    }
    all_questions = []  # rapor ornekleme icin

    for ki, key in enumerate(keys):
        e = inv[key]
        lemma, pos = e["lemma"], e["pos"]
        # (1) hikaye cumleleri (gate istatistigi + kalan ornekleri toplayarak)
        chosen = []
        seen = set()
        attempts = 0
        for o in e["occ"]:
            if len(chosen) >= MAX_SENTS_PER_LEMMA or attempts >= MAX_STORY_ATTEMPTS:
                break
            text = o["text"].strip()
            if text in seen:
                continue
            seen.add(text)
            attempts += 1
            stats["storyGateAttempt"] += 1
            g = gate(mlm, text, o["surface"], lemma, pos, o["propn_ratio"])
            if g["pass"]:
                stats["storyGatePass"] += 1
                chosen.append({"sentence": text, "surface": o["surface"], "tag": o["tag"],
                               "level": o["level"], "gate": g["score"], "_probs": g["probs"],
                               "source": {"type": "story", "storyId": o["storyId"],
                                          "level": o["level"], "p": o["p"], "s": o["s"]}})
            elif len(stats["storyGateRejects"]) < 40:
                stats["storyGateRejects"].append(
                    {"lemma": lemma, "pos": pos, "surface": o["surface"],
                     "sentence": text, "reason": g["reason"], "top": g["top10"][:5]})
        # (2) Tatoeba
        used_tatoeba = False
        if len(chosen) < MAX_SENTS_PER_LEMMA and tatoeba_index is not None:
            more = tatoeba_sentences(key, tatoeba_index, mlm, e, MAX_SENTS_PER_LEMMA - len(chosen))
            if more:
                used_tatoeba = True
            chosen += more
        if used_tatoeba and chosen:
            stats["tatoebaClosed"] += 1

        # (3) hala 0 -> LLM gerekli
        if not chosen:
            stats["zeroLemmas"].append(key.replace("\t", "|"))
            stats["llmNeeded"].append(key.replace("\t", "|"))

        # ---- Celdirici + soru ----
        qcount = 0
        for si, s in enumerate(chosen):
            # gate zaten [MASK] dagilimini uretti; tekrar MLM cagirma (hiz).
            masked_probs = s.get("_probs")
            if masked_probs is None:
                _, masked_probs = mlm.predict(s["sentence"], s["surface"], top_k=GATE_TOPK)
            if masked_probs is None:
                continue
            sw = words_of(s["sentence"])
            dists, dstat = pick_distractors(
                mlm, s["sentence"], s["surface"], lemma, pos, s["tag"],
                s["gate"], masked_probs, pool, sw)
            if len(dists) < 3:
                if len(stats["noDistractor"]) < 40:
                    stats["noDistractor"].append({"lemma": lemma, "pos": pos,
                                                  "surface": s["surface"], **dstat})
                continue
            options = [s["surface"]] + dists[:3]
            random.shuffle(options)
            q = {
                "id": f"{lemma}|{pos}|{si}",
                "sentence": blank(s["sentence"], s["surface"]),
                "answer": s["surface"],
                "options": options,
                "tag": s["tag"], "level": s["level"],
                "source": s["source"], "gate": s["gate"],
            }
            err = validate_question(q)
            if err:
                continue
            shards.setdefault(shard_of(lemma), {}).setdefault(key.replace("\t", "|"), []).append(q)
            all_questions.append(q)
            qcount += 1
        stats["dist"][str(min(qcount, 3))] += 1
        stats["questions"] += qcount
        if (ki + 1) % 100 == 0:
            print(f"  {ki+1}/{len(keys)} lemma | soru {stats['questions']} | {time.time()-t0:.0f}s", flush=True)

    # ---- Cikti yaz ----
    os.makedirs(OUT_DIR, exist_ok=True)
    shard_names = sorted(shards.keys())
    for name, data in shards.items():
        with open(os.path.join(OUT_DIR, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"quizVersion": QUIZ_VERSION, "shards": shard_names}, f, ensure_ascii=False, separators=(",", ":"))

    # ---- Rapor ----
    dur = time.time() - t0
    file_sizes = {n: os.path.getsize(os.path.join(OUT_DIR, f"{n}.json")) for n in shard_names}
    sample = random.sample(all_questions, min(30, len(all_questions)))
    report = {
        "thresholds": {
            "GATE_TOPK": GATE_TOPK, "GATE_TARGET_IN_TOPN": GATE_TARGET_IN_TOPN,
            "GATE_MIN_PROB": GATE_MIN_PROB, "SENT_WORDS": [SENT_MIN_WORDS, SENT_MAX_WORDS],
            "PROPN_MAX_RATIO": PROPN_MAX_RATIO, "DISTRACTOR_MAX_PROB": DISTRACTOR_MAX_PROB,
            "DISTRACTOR_RATIO": DISTRACTOR_RATIO, "ZIPF_WINDOW": ZIPF_WINDOW,
            "CEFR": "wordfreq zipf: A1>=5.5 A2>=4.8 B1>=4.0 B2>=3.2 else C1",
        },
        "targetLemmas": len(keys),
        "storyGate": {"attempt": stats["storyGateAttempt"], "pass": stats["storyGatePass"],
                      "passRate": round(stats["storyGatePass"] / max(1, stats["storyGateAttempt"]), 3)},
        "storyGateRejectSamples": stats["storyGateRejects"][:10],
        "tatoebaClosedLemmas": stats["tatoebaClosed"],
        "zeroQuestionLemmas": len(stats["zeroLemmas"]),
        "llmNeeded": stats["llmNeeded"],
        "questionsPerLemmaDist": stats["dist"],
        "totalQuestions": stats["questions"],
        "noDistractorSamples": stats["noDistractor"][:10],
        "sample30": sample,
        "durationSec": round(dur, 1),
        "estimateFullSec": round(dur / max(1, len(keys)) * len(inv), 0),
        "fileSizes": file_sizes,
    }
    with open(os.path.join(CACHE_DIR, "quiz-report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n=== OZET ===", flush=True)
    print(f"hedef lemma|pos: {len(keys)} | soru: {stats['questions']} | sure: {dur:.0f}s", flush=True)
    print(f"hikaye gate gecme: {report['storyGate']['pass']}/{report['storyGate']['attempt']} "
          f"(%{report['storyGate']['passRate']*100:.0f})", flush=True)
    print(f"tatoeba ile kapanan lemma: {stats['tatoebaClosed']} | 0 soruluk (LLM gerekli): {len(stats['zeroLemmas'])}", flush=True)
    print(f"soru/lemma dagilimi: {stats['dist']}", flush=True)
    print(f"tahmini tam kosu (10391): {report['estimateFullSec']/60:.0f} dk", flush=True)
    print(f"rapor -> {os.path.join(CACHE_DIR, 'quiz-report.json')}", flush=True)


if __name__ == "__main__":
    main()
