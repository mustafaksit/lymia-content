"""
ADIM 3: Celdirici uretimi. Soru basina 3 celdirici.
Havuz: ayni POS + tag'lenebilir, zipf hedefe +-1, CEFR hedefle ayni/±1.
Ele: ayni lemma, WordNet es/hiper/hiponim, ayni kok, cumlede gecen kelimeler.
MLM: celdirici [MASK] olasiligi <= 0.01 VE hedefin onda birinden kucuk.
Cekim: hedefin surface tag'ine gore (lemminflect).
"""
from common import (
    ZIPF_WINDOW, DISTRACTOR_MAX_PROB, DISTRACTOR_RATIO, CEFR_ORDER,
    zipf, cefr_from_zipf, wordnet_related, same_root, inflect,
)


def build_pool(inv):
    """POS -> [{lemma, zipf, cefr}] (tum envanter; celdirici cesitliligi icin)."""
    pool = {}
    seen = {}
    for key, e in inv.items():
        lemma, pos = e["lemma"], e["pos"]
        if pos not in ("VERB", "NOUN", "ADJ", "ADV"):
            continue
        z = zipf(lemma)
        if z <= 0:
            continue
        dedup = seen.setdefault(pos, set())
        if lemma in dedup:
            continue
        dedup.add(lemma)
        pool.setdefault(pos, []).append({"lemma": lemma, "zipf": z, "cefr": cefr_from_zipf(z)})
    return pool


def pick_distractors(mlm, sentence, surface, target_lemma, pos, tag,
                     target_prob, masked_probs, pool, sentence_words, need=3):
    """3 (veya daha az) cekimli celdirici yuzeyi dondur + eleme istatistigi."""
    tz = zipf(target_lemma)
    tcefr = CEFR_ORDER[cefr_from_zipf(tz)]
    related = wordnet_related(target_lemma, pos)
    sent_low = {w.lower() for w in sentence_words}

    cands = []
    for c in pool.get(pos, []):
        lemma = c["lemma"]
        if lemma == target_lemma:
            continue
        if abs(c["zipf"] - tz) > ZIPF_WINDOW:
            continue
        if abs(CEFR_ORDER[c["cefr"]] - tcefr) > 1:
            continue
        if lemma in related:
            continue
        if same_root(lemma, target_lemma):
            continue
        if lemma.lower() in sent_low:
            continue
        cands.append(c)
    # hedefe siklik olarak en yakinlar once (makul zorluk)
    cands.sort(key=lambda c: abs(c["zipf"] - tz))

    chosen, chosen_low, tried, rejected = [], set(), 0, 0
    threshold = min(DISTRACTOR_MAX_PROB, target_prob * DISTRACTOR_RATIO)
    for c in cands:
        if len(chosen) >= need:
            break
        form = inflect(c["lemma"], tag, pos)
        fl = form.lower()
        if not form.isalpha():
            continue
        if fl == surface.lower() or fl in chosen_low or fl in sent_low:
            continue
        tried += 1
        p = mlm.prob_of(masked_probs, form)
        if p <= threshold:
            chosen.append(form)
            chosen_low.add(fl)
        else:
            rejected += 1
    return chosen, {"candidates": len(cands), "tried": tried, "rejected": rejected}
