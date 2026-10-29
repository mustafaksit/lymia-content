"""
ADIM 2: Cumle kaynagi. lemma|pos basina <=3 gecen cumle.
Sira: (1) hikaye cumleleri (annot), (2) Tatoeba (cekim iceren, seviye-uygun),
(3) hala 0 -> "LLM gerekli" listesi (LLM CAGRISI YAPILMAZ).
"""
import re
from common import (
    MAX_SENTS_PER_LEMMA, SENT_MIN_WORDS, SENT_MAX_WORDS, TATOEBA_TSV,
    all_forms, word_count, cefr_from_zipf, zipf,
)
from gate import gate

def story_sentences(entry, mlm, limit=MAX_SENTS_PER_LEMMA):
    """Hikaye gecislerini kapidan gecir; gecenleri dondur (metin bazli dedup)."""
    out, seen = [], set()
    for o in entry["occ"]:
        text = o["text"].strip()
        if text in seen:
            continue
        seen.add(text)
        g = gate(mlm, text, o["surface"], entry["lemma"], entry["pos"], o["propn_ratio"])
        if g["pass"]:
            out.append({
                "sentence": text, "surface": o["surface"], "tag": o["tag"],
                "level": o["level"], "gate": g["score"],
                "source": {"type": "story", "storyId": o["storyId"], "level": o["level"],
                           "p": o["p"], "s": o["s"]},
            })
            if len(out) >= limit:
                break
    return out


def build_tatoeba_index(keys, inv, max_per_key=40):
    """Tek gecis: hedef lemma'larin cekim yuzeyleri -> Tatoeba adaylari (id, text, surface).
    keys: 'lemma\\tpos' kumesi. Yalniz 6-22 kelimelik cumleler."""
    # yuzey -> [(key, lemma, pos)]
    form_map = {}
    for k in keys:
        lemma, pos = k.split("\t")
        for f in all_forms(lemma, pos):
            if f.isalpha() and len(f) >= 2:
                form_map.setdefault(f, []).append((k, lemma, pos))
    index = {k: [] for k in keys}
    full = {k: False for k in keys}
    word_re = re.compile(r"[A-Za-z']+")
    with open(TATOEBA_TSV, encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            sid, _, text = parts
            words = word_re.findall(text)
            n = len(words)
            if n < SENT_MIN_WORDS or n > SENT_MAX_WORDS:
                continue
            lowered = {w.lower(): w for w in words}
            for w_low, w_orig in lowered.items():
                hit = form_map.get(w_low)
                if not hit:
                    continue
                for (k, lemma, pos) in hit:
                    if full[k]:
                        continue
                    # yuzey cumlede tek kez
                    if sum(1 for x in words if x.lower() == w_low) != 1:
                        continue
                    index[k].append((sid, text, w_orig))
                    if len(index[k]) >= max_per_key:
                        full[k] = True
    return index


def tatoeba_sentences(key, index, mlm, entry, need):
    """Tatoeba adaylarini kapidan gecir; en fazla `need` cumle dondur.
    Seviye: wordfreq zipf tahmini (hedef lemma)."""
    lemma, pos = entry["lemma"], entry["pos"]
    lvl = cefr_from_zipf(zipf(lemma))
    out = []
    for (sid, text, surface) in index.get(key, []):
        # tag: yuzeyin lemma cekimini kestir (basit: surface==lemma -> taban, degilse annot yok)
        g = gate(mlm, text, surface, lemma, pos)
        if g["pass"]:
            tag = _guess_tag(surface, lemma, pos)
            out.append({
                "sentence": text, "surface": surface, "tag": tag,
                "level": lvl, "gate": g["score"], "_probs": g["probs"],
                "source": {"type": "tatoeba", "id": int(sid)},
            })
            if len(out) >= need:
                break
    return out


def _guess_tag(surface, lemma, pos):
    """Tatoeba'da annot yok; yuzey->Penn tag kestirimi (lemminflect ile eslesme)."""
    from lemminflect import getInflection
    s = surface.lower()
    tagset = {
        "VERB": ["VBD", "VBZ", "VBG", "VBN", "VB"],
        "NOUN": ["NNS", "NN"],
        "ADJ": ["JJR", "JJS", "JJ"],
        "ADV": ["RBR", "RBS", "RB"],
    }.get(pos, ["NN"])
    for tag in tagset:
        forms = getInflection(lemma, tag=tag)
        if forms and forms[0].lower() == s:
            return tag
    return tagset[-1]


def collect_sentences(entry, key, mlm, tatoeba_index):
    """Bir lemma|pos icin nihai cumle listesi (<=3) + kaynak dagitimi."""
    sents = story_sentences(entry, mlm)
    if len(sents) < MAX_SENTS_PER_LEMMA and tatoeba_index is not None:
        need = MAX_SENTS_PER_LEMMA - len(sents)
        sents += tatoeba_sentences(key, tatoeba_index, mlm, entry, need)
    return sents
