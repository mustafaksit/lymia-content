#!/usr/bin/env python3
"""Klasikler batch-01 kalite kapilari (otomatik, loglu).

Kapilar (her hikaye, her seviye):
  1 schema     - uygulamanin zod semasi + repo semasi + index girdisi (gate-node.mjs)
  2 detectors  - D1-D5 = 0 bulgu (pipeline/lib/detectors.mjs) + audit --strict hatasi = 0
  3 grammar    - LanguageTool yerel: GRAMMAR/TYPOS/CONFUSED_WORDS/CASING/PUNCTUATION = 0; stil raporlanir
  4 profile    - kelime sayisi, medyan cumle uzunlugu, zipf medyani baseline [min,max] icinde;
                 cumle tavani (repo kurali); A1-A2 zipf<3.5 orani <= baseline max;
                 seviyeye yasak yapi taramasi; NGSL kapsami raporlanir (uyari)
  6 copyright  - copyright-terms.json, 0 eslesme
  7 duplicate  - mevcut 200 ile baslik/ozet n-gram benzerligi + A1 metin 5-gram ortusmesi
  (5 kor inceleme ayri: ajanlarla, sonuc reviews/ altinda)

Kullanim:
  CLASSICS_BATCH=qa/classics-batch-NN pipeline/.venv/bin/python pipeline/classics/gates.py [st-XXXX ...] [--no-lt]
Cikti: $CLASSICS_BATCH/gates/<id>.json + gates/log.jsonl (her kosu bir satir)
Cikis kodu: herhangi bir kapi KALDI ise 1.
"""
import json
import os
import re
import statistics as st
import subprocess
import sys
import time
from pathlib import Path

from wordfreq import zipf_frequency

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from batch import ROOT, batch_dir  # noqa: E402

QA = batch_dir()
V2 = ROOT / "content" / "v2"
LEVELS = ["A1", "A2", "B1", "B2", "C1"]
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’]*")
MAX_SENT = {"A1": 8, "A2": 12, "B1": 16, "B2": 22, "C1": 32}  # pipeline/lib/levels.mjs
NEW_IDS_FILE = QA / "batch-ids.json"

BASE = json.loads((ROOT / "stats" / "baseline-v2.json").read_text())["levels"]
COPY = json.loads((HERE / "copyright-terms.json").read_text())["terms"]
SOURCES = json.loads((V2 / "sources.json").read_text()) if (V2 / "sources.json").exists() else {}

# ---------------------------------------------------------------- yardimcilar

def sentences(level):
    return [s["text"].strip() for p in level["paragraphs"] for s in p["sentences"]]


def proper_nouns(sents, extra=()):
    caps, lower = set(), set()
    for s in sents:
        for i, t in enumerate(WORD_RE.findall(s)):
            base = t.replace("’", "'").split("'")[0]
            if not base:
                continue
            if base[0].isupper():
                if i > 0:
                    caps.add(base)
            else:
                lower.add(base.lower())
    pn = {c for c in caps if c.lower() not in lower and c != "I"}
    return pn | set(extra)


def story_names(story_id):
    src = SOURCES.get("stories", {}).get(story_id, {})
    names = set()
    for n in src.get("names", []):
        names.update(WORD_RE.findall(n))
    return names


def story_key_terms(story_id):
    return {t.lower() for t in SOURCES.get("stories", {}).get(story_id, {}).get("keyTerms", [])}


# ------------------------------------------------- seviye yasak yapi taramasi
SUBJ_AFTER_THAT = set("i you he she it we they the a an his her their my your our this there its".split())
VERBISH_AFTER_THAT = set(
    "was were is are had has have lived lives made makes came comes went goes looked looks wanted wants "
    "knew knows saw sees said says could can would will did does ran runs gave gives took takes".split()
)
PP_IRREG = set(
    "been born brought built bought caught chosen done drawn driven eaten fallen felt found forgotten "
    "forgiven frozen given gone grown heard held hidden hit hurt kept known laid led left lent lost made "
    "meant met paid put read ridden rung risen run said seen sold sent set shaken shot shown shut sung "
    "sunk sat slept spoken spent stood stolen struck sworn swept swum taken taught torn told thought "
    "thrown understood woken worn won written bound beaten bitten blown broken dug fed fought flown hung "
    "ground spun spread stuck stung woven wound".split()
)
# durum/duygu sifati olarak kullanilan ortaclar: edilgen sayilmaz
ADJ_PARTICIPLES = set(
    "tired scared frightened surprised excited worried interested bored married pleased amazed delighted "
    "ashamed afraid closed open dressed lost gone shocked annoyed confused embarrassed satisfied disappointed "
    "upset hurt finished done ready alone asleep awake alive dead astonished terrified exhausted puzzled "
    "relieved determined crowded tied locked hidden broken stuck frozen born filled covered made".split()
)
NON_PP_ED = set(
    "red bed need feed seed speed shed sled hundred sacred naked wicked crooked beloved ragged wretched "
    "rugged kindred bred fed led shred thread wed weed".split()
)
ING_NOUNS = set(
    "morning evening nothing something anything everything king ring wing spring string thing building "
    "ceiling wedding darling sing bring sling swing sting cling feeling beginning".split()
)
BE = r"(?:am|is|are|was|were|be|been|being)"


def tokens_lower(s):
    return [t.lower().replace("’", "'") for t in WORD_RE.findall(s)]


def is_pp(w):
    if w in PP_IRREG:
        return True
    return len(w) > 4 and w.endswith("ed") and w not in NON_PP_ED


def structure_hits(level, s):
    """Seviyeye yasak yapilar. A1/A2: kosul, would/will, relative/that-clause, edilgen,
    perfect, surekli zamanlar. B1: kosul (if) + edilgen. B2/C1 serbest."""
    hits = []
    toks = tokens_lower(s)
    if level in ("A1", "A2"):
        for i, w in enumerate(toks):
            nxt = toks[i + 1] if i + 1 < len(toks) else ""
            prv = toks[i - 1] if i > 0 else ""
            if w in ("if", "unless", "would", "will", "shall", "which", "whose", "whom", "whoever", "whatever"):
                hits.append(f"'{w}'")
            elif w in ("won't", "wouldn't", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll", "it'll"):
                hits.append(f"'{w}'")
            elif w == "that" and (nxt in SUBJ_AFTER_THAT or nxt in VERBISH_AFTER_THAT):
                hits.append(f"that-clause 'that {nxt}'")
            elif w == "who" and not s.rstrip().rstrip('"”’\'').endswith("?"):
                hits.append("relative 'who'")
            elif w in ("had", "has", "have", "hadn't", "hasn't", "haven't") and is_pp(nxt) and nxt not in ("made",):
                hits.append(f"perfect '{w} {nxt}'")
            elif w in ("am", "is", "are", "was", "were", "be", "been", "isn't", "wasn't", "aren't", "weren't"):
                # bir zarf atlamaya izin ver: "was quickly taken"
                cand = [nxt] + ([toks[i + 2]] if i + 2 < len(toks) and nxt.endswith("ly") else [])
                for c in cand:
                    if is_pp(c) and c not in ADJ_PARTICIPLES:
                        hits.append(f"passive '{w} {c}'")
                        break
                    if c.endswith("ing") and len(c) > 4 and c not in ING_NOUNS and c not in ("amazing", "interesting", "boring", "exciting", "loving", "missing", "darling"):
                        hits.append(f"continuous '{w} {c}'")
                        break
    elif level == "B1":
        for i, w in enumerate(toks):
            nxt = toks[i + 1] if i + 1 < len(toks) else ""
            prv = toks[i - 1] if i > 0 else ""
            if w in ("if", "unless") and prv not in ("asked", "ask", "asks", "wondered", "wonder", "see", "know", "knew"):
                hits.append(f"conditional '{w}'")
            elif w in ("am", "is", "are", "was", "were", "be", "been", "being", "isn't", "wasn't", "aren't", "weren't"):
                cand = [nxt] + ([toks[i + 2]] if i + 2 < len(toks) and nxt.endswith("ly") else [])
                for c in cand:
                    if is_pp(c) and c not in ADJ_PARTICIPLES:
                        hits.append(f"passive '{w} {c}'")
                        break
    return hits


# ---------------------------------------------------------------- kapilar

def gate_node(path):
    env = dict(os.environ)
    env.setdefault("APP_REPO", str(ROOT.parent / "lymia-app"))
    r = subprocess.run(["node", str(HERE / "gate-node.mjs"), str(path)], capture_output=True, text=True, env=env)
    if r.returncode != 0 or not r.stdout.strip():
        return {"error": r.stderr[-2000:]}
    return json.loads(r.stdout)


_LT = None


def lt():
    global _LT
    if _LT is None:
        import language_tool_python

        os.environ["PATH"] = "/opt/homebrew/opt/openjdk/bin:" + os.environ["PATH"]
        # LT_SERVER (orn. http://localhost:8081): paylasilan yerel sunucu; yoksa gomulu baslatir.
        srv = os.environ.get("LT_SERVER", "http://localhost:8081")
        try:
            import urllib.request

            urllib.request.urlopen(srv + "/v2/languages", timeout=3)
            _LT = language_tool_python.LanguageTool("en-US", remote_server=srv)
        except Exception:
            _LT = language_tool_python.LanguageTool("en-US")
    return _LT


ERROR_CATS = {"GRAMMAR", "TYPOS", "CONFUSED_WORDS", "CASING", "PUNCTUATION", "COLLOCATIONS", "NONSTANDARD_PHRASES", "SEMANTICS"}
# Tasarim geregi kapsam disi kurallar (gerekce ile):
IGNORE_RULES = {
    "EN_QUOTES": "duz tirnak kullaniyoruz (katalog standardi)",
    "DASH_RULE": "tire tipografisi",
    "WHITESPACE_RULE": "tipografi",
    "UPPERCASE_SENTENCE_START": "konusma tirnagi sonrasi kucuk harf ('\"Help!\" she said') LT yanlis-pozitifi",
}


def gate_grammar(story, names):
    out = {}
    for lvl in LEVELS:
        if lvl not in story["levels"]:
            continue
        text = "\n\n".join(" ".join(s["text"] for s in p["sentences"]) for p in story["levels"][lvl]["paragraphs"])
        errs, style = [], []
        for m in lt().check(text):
            frag = text[m.offset : m.offset + m.error_length]
            item = {"rule": m.rule_id, "cat": m.category, "msg": m.message, "frag": frag,
                    "ctx": text[max(0, m.offset - 40) : m.offset + m.error_length + 40].replace("\n", " ")}
            if m.rule_id in IGNORE_RULES:
                continue
            if m.category == "TYPOS" and (set(WORD_RE.findall(frag)) <= names):
                continue  # hikayenin ozel isimleri (sources.json names)
            if m.rule_id == "UPPERCASE_SENTENCE_START":
                continue
            (errs if m.category in ERROR_CATS else style).append(item)
        out[lvl] = {"errors": errs, "style": style}
    return out


def in_range(v, d):
    return d["min"] <= v <= d["max"]


def gate_profile(story, names, key_terms=frozenset()):
    out = {}
    for lvl in LEVELS:
        lv = story["levels"].get(lvl)
        if not lv:
            continue
        sents = sentences(lv)
        pn = proper_nouns(sents, names)
        words, lens, struct, long_s = [], [], [], []
        for s in sents:
            toks = WORD_RE.findall(s)
            lens.append(len(toks))
            words.extend(toks)
            if len(toks) > MAX_SENT[lvl]:
                long_s.append(f"{len(toks)}>{MAX_SENT[lvl]}: {s}")
            for h in structure_hits(lvl, s):
                struct.append(f"{h} :: {s}")
            # Rakam: TTS onu kelime olarak okur ama app karaoke'si [A-Za-z] sayar -> vurgu kayar.
            if re.search(r"\d", s):
                struct.append(f"rakam (yaziyla yaz) :: {s}")
        content = [w for w in words if w.replace("’", "'").split("'")[0] not in pn]
        key_hits = sum(1 for w in content if w.lower() in key_terms or w.lower().rstrip("s") in key_terms)
        content = [w for w in content if not (w.lower() in key_terms or w.lower().rstrip("s") in key_terms)]
        z = [zipf_frequency(w.lower().replace("’", "'"), "en") for w in content]
        low = [w for w, x in zip(content, z) if x < 3.5]
        m = {
            "words": len(words),
            "sentLenMedian": st.median(lens),
            "zipfMedian": round(st.median(z), 2),
            "lowZipfRatio": round(len(low) / len(z), 4),
            "lowZipfWords": sorted(set(w.lower() for w in low)),
            "keyTermTokens": key_hits,
        }
        b = BASE[lvl]
        fails = []
        if not in_range(m["words"], b["words"]):
            fails.append(f"kelime {m['words']} baseline [{b['words']['min']},{b['words']['max']}] disi")
        if not in_range(m["sentLenMedian"], b["sentLen"]):
            fails.append(f"medyan cumle {m['sentLenMedian']} baseline [{b['sentLen']['min']},{b['sentLen']['max']}] disi")
        if not in_range(m["zipfMedian"], b["zipf"]):
            fails.append(f"zipf medyan {m['zipfMedian']} baseline [{b['zipf']['min']},{b['zipf']['max']}] disi")
        if lvl in ("A1", "A2") and m["lowZipfRatio"] > b["lowZipfRatio"]["max"]:
            fails.append(f"zipf<3.5 orani {m['lowZipfRatio']} > baseline max {b['lowZipfRatio']['max']}")
        if long_s:
            fails.append(f"{len(long_s)} cumle tavan ustu")
        if struct:
            fails.append(f"{len(struct)} yasak yapi")
        out[lvl] = {**m, "longSentences": long_s, "structures": struct, "fails": fails}
    return out


def gate_quiz(story):
    fails = []
    answers = []
    for lvl, lv in story["levels"].items():
        for i, q in enumerate(lv["quiz"]):
            answers.append(q["answer"])
            if len(set(o.strip().lower() for o in q["options"])) != 3:
                fails.append(f"{lvl} q{i}: tekrar eden sik")
            if not q["q"].strip().endswith("?"):
                fails.append(f"{lvl} q{i}: soru isareti yok")
    if answers and len(set(answers)) == 1:
        fails.append("tum cevaplar ayni indekste")
    return {"answerDist": {k: answers.count(k) for k in (0, 1, 2)}, "fails": fails}


def all_texts(story):
    yield "title", story.get("title", "")
    yield "summary", story.get("summary", "")
    yield "coverScene", story.get("coverScene", "")
    for lvl, lv in story["levels"].items():
        for s in sentences(lv):
            yield lvl, s
        for q in lv["quiz"]:
            yield f"{lvl}.quiz", " ".join([q["q"], *q["options"]])


def gate_copyright(story):
    hits = []
    for where, text in all_texts(story):
        for t in COPY:
            if re.search(r"(?<![A-Za-z])" + re.escape(t["term"]) + r"(?![A-Za-z])", text, re.I):
                hits.append({"term": t["term"], "work": t["work"], "where": where, "text": text[:160]})
    return {"hits": hits}


def ngrams(words, n):
    return {tuple(words[i : i + n]) for i in range(len(words) - n + 1)}


def jacc(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0


_EXIST = None


def existing():
    global _EXIST
    if _EXIST is None:
        new_ids = set(json.loads(NEW_IDS_FILE.read_text())) if NEW_IDS_FILE.exists() else set()
        idx = json.loads((V2 / "index.json").read_text())
        _EXIST = []
        for s in idx["stories"]:
            if s["id"] in new_ids:
                continue
            body = json.loads((V2 / "stories" / f"{s['id']}.json").read_text())
            a1 = " ".join(sentences(body["levels"]["A1"])) if "A1" in body["levels"] else ""
            _EXIST.append({"id": s["id"], "title": s["title"], "summary": s.get("summary", ""), "a1": a1})
    return _EXIST


def gate_duplicate(story):
    def w(t):
        return [x.lower() for x in WORD_RE.findall(t)]

    t_words = set(w(story["title"])) - {"the", "a", "an", "of", "and", "in"}
    s3 = ngrams(w(story.get("summary", "")), 3)
    a1_5 = ngrams(w(" ".join(sentences(story["levels"]["A1"]))), 5)
    top = []
    for e in existing():
        tj = jacc(t_words, set(w(e["title"])) - {"the", "a", "an", "of", "and", "in"})
        sj = jacc(s3, ngrams(w(e["summary"]), 3))
        a1 = len(a1_5 & ngrams(w(e["a1"]), 5)) / max(1, len(a1_5))
        top.append({"id": e["id"], "title": e["title"], "titleJaccard": round(tj, 3), "summary3gramJaccard": round(sj, 3), "a1FiveGramOverlap": round(a1, 3)})
    top.sort(key=lambda x: (x["titleJaccard"], x["summary3gramJaccard"], x["a1FiveGramOverlap"]), reverse=True)
    worst = {k: max(x[k] for x in top) for k in ("titleJaccard", "summary3gramJaccard", "a1FiveGramOverlap")}
    fails = []
    if worst["titleJaccard"] >= 0.5:
        fails.append(f"baslik jaccard {worst['titleJaccard']}")
    if worst["summary3gramJaccard"] >= 0.2:
        fails.append(f"ozet 3-gram jaccard {worst['summary3gramJaccard']}")
    if worst["a1FiveGramOverlap"] >= 0.1:
        fails.append(f"A1 5-gram ortusme {worst['a1FiveGramOverlap']}")
    return {"worst": worst, "top3": top[:3], "fails": fails}


# ---------------------------------------------------------------- ana akis

def run(story_id, use_lt=True):
    path = V2 / "stories" / f"{story_id}.json"
    story = json.loads(path.read_text())
    names = story_names(story_id)
    res = {"id": story_id, "title": story["title"], "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}
    node = gate_node(path)
    res["node"] = node
    verdict = {}

    # 1 sema
    sch = node.get("schema", {})
    f1 = []
    if node.get("error"):
        f1.append(node["error"])
    if sch.get("appZod") != "ok":
        f1.append("app zod KALDI")
    if sorted(sch.get("appZodLevels", [])) != sorted(LEVELS):
        f1.append(f"app zod seviyeleri {sch.get('appZodLevels')}")
    f1 += sch.get("repoSchema", [])
    if sch.get("indexEntry") != "ok" or sch.get("indexZod") != "ok":
        f1.append(f"index: zod={sch.get('indexZod')} entry={sch.get('indexEntry')}")
    verdict["1_schema"] = f1

    # 2 D1-D5 + audit strict
    f2 = []
    for lvl, d in node.get("detectors", {}).items():
        for k, v in d.items():
            if v:
                f2.append(f"{lvl} {k.upper()}: {v}")
    f2 += [f"audit: {e}" for e in node.get("audit", {}).get("errors", [])]
    verdict["2_detectors"] = f2

    # 3 LanguageTool
    if use_lt:
        g = gate_grammar(story, names)
        res["grammar"] = g
        verdict["3_grammar"] = [f"{l} {e['rule']}: {e['ctx']}" for l, v in g.items() for e in v["errors"]]
    else:
        verdict["3_grammar"] = ["ATLANDI (--no-lt)"]

    # 4 seviye profili
    p = gate_profile(story, names, story_key_terms(story_id))
    res["profile"] = p
    res["ngsl"] = node.get("ngsl", {})
    verdict["4_profile"] = [f"{l}: {f}" for l, v in p.items() for f in v["fails"]]
    # Ardisik etiketsiz tirnak: '..."' + '"..."' Ingilizcede yeni konusmaci demektir.
    # Ayni konusmacinin devami ise tirnak ilk cumlede acilip son cumlede kapanmali.
    for lvl, lv in story["levels"].items():
        for para in lv["paragraphs"]:
            ss = [x["text"].strip() for x in para["sentences"]]
            for a, b in zip(ss, ss[1:]):
                if a.endswith('"') and b.startswith('"') and b.endswith('"') and b.count('"') == 2:
                    verdict["4_profile"].append(f"{lvl}: ardisik etiketsiz tirnak (konusmaci belirsiz) :: {b}")
    q = gate_quiz(story)
    res["quiz"] = q
    verdict["4_profile"] += [f"quiz: {f}" for f in q["fails"]]

    # 6 telif
    c = gate_copyright(story)
    res["copyright"] = c
    verdict["6_copyright"] = [f"{h['term']} ({h['where']})" for h in c["hits"]]

    # 7 tekrar
    d = gate_duplicate(story)
    res["duplicate"] = d
    verdict["7_duplicate"] = d["fails"]

    res["verdict"] = {k: ("GECTI" if not v else "KALDI") for k, v in verdict.items()}
    res["failures"] = verdict
    out_dir = QA / "gates"
    out_dir.mkdir(exist_ok=True)
    (out_dir / f"{story_id}.json").write_text(json.dumps(res, indent=2, ensure_ascii=False) + "\n")
    with open(out_dir / "log.jsonl", "a") as f:
        f.write(json.dumps({"ts": res["ts"], "id": story_id, "verdict": res["verdict"],
                            "nFail": {k: len(v) for k, v in verdict.items()}}, ensure_ascii=False) + "\n")
    return res


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    use_lt = "--no-lt" not in sys.argv
    if not args:
        args = json.loads(NEW_IDS_FILE.read_text())
    bad = 0
    for sid in args:
        r = run(sid, use_lt)
        ok = all(v == "GECTI" for v in r["verdict"].values())
        bad += 0 if ok else 1
        print(f"== {sid} {r['title']}: {'TUM KAPILAR GECTI' if ok else 'KALDI'}")
        for k, v in r["failures"].items():
            mark = "ok " if not v else "XX "
            print(f"   {mark}{k}" + ("" if not v else f" ({len(v)})"))
            for item in v[:40]:
                print(f"       - {item}")
        prof = r["profile"]
        print("   profil: " + " | ".join(
            f"{l} {v['words']}w s{v['sentLenMedian']} z{v['zipfMedian']} low{v['lowZipfRatio']} ngsl{r['ngsl'].get(l, {}).get('coverage')}"
            for l, v in prof.items()))
    if _LT is not None:
        _LT.close()
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
