"""
ADIM 1: Cozulebilirlik kapisi. Cumle + hedef kelime -> [MASK] -> MLM ilk 20
tahmin. Hedef (veya lemma'nin ayni tag'li cekimi) ilk N'de VE olasiligi >= esik
ise GECER. Ek: uzunluk 6-22, hedef tek kez, PROPN orani < %25.
"""
import re
from common import (
    GATE_TOPK, GATE_TARGET_IN_TOPN, GATE_MIN_PROB, SENT_MIN_WORDS, SENT_MAX_WORDS,
    PROPN_MAX_RATIO, word_count, words_of,
)

def _same_lemma(pred_token, lemma, pos):
    from lemminflect import getLemma
    from common import _UPOS
    t = pred_token.lower()
    if not t.isalpha():
        return False
    if t == lemma.lower():
        return True
    lem = getLemma(t, upos=_UPOS.get(pos, "NOUN"))
    return bool(lem) and lem[0].lower() == lemma.lower()

def surface_count(sentence, surface):
    return len(re.findall(r"\b" + re.escape(surface) + r"\b", sentence))

def gate(mlm, sentence, surface, lemma, pos, propn_ratio=None):
    """Dict: {pass, score, reason, top10}."""
    wc = word_count(sentence)
    if wc < SENT_MIN_WORDS or wc > SENT_MAX_WORDS:
        return {"pass": False, "score": 0.0, "reason": f"len {wc}", "top10": []}
    if surface_count(sentence, surface) != 1:
        return {"pass": False, "score": 0.0, "reason": "surface !=1", "top10": []}
    if propn_ratio is None:
        propn_ratio = _propn_ratio(sentence)
    if propn_ratio >= PROPN_MAX_RATIO:
        return {"pass": False, "score": 0.0, "reason": f"propn {propn_ratio:.2f}", "top10": []}

    preds, probs = mlm.predict(sentence, surface, top_k=GATE_TOPK)
    if not preds:
        return {"pass": False, "score": 0.0, "reason": "mask yok", "top10": []}

    # hedef lemma'yla eslesen ilk tahmin (rank + prob)
    target_rank, target_prob = None, 0.0
    for i, (tok, p) in enumerate(preds):
        if _same_lemma(tok, lemma, pos):
            target_rank, target_prob = i, p
            break

    top10 = [[t, round(p, 4)] for t, p in preds[:10]]
    passed = (
        target_rank is not None
        and target_rank < GATE_TARGET_IN_TOPN
        and target_prob >= GATE_MIN_PROB
    )
    reason = "ok" if passed else (
        "hedef top-N disi" if target_rank is None or target_rank >= GATE_TARGET_IN_TOPN
        else f"dusuk prob {target_prob:.3f}"
    )
    # probs: [MASK] tam olasilik dagilimi (celdirici asamasi tekrar MLM cagirmasin).
    return {"pass": passed, "score": round(target_prob, 4), "reason": reason,
            "rank": target_rank, "top10": top10, "probs": probs}

# spaCy'siz kaba PROPN tahmini (Tatoeba icin; ortadaki buyuk harf ~ ozel isim)
_cap_mid = re.compile(r"(?<!^)(?<![.!?]\s)\b[A-Z][a-z]+")
def _propn_ratio(sentence):
    ws = words_of(sentence)
    if not ws:
        return 1.0
    caps = sum(1 for i, w in enumerate(ws) if i > 0 and w[:1].isupper())
    return caps / len(ws)


if __name__ == "__main__":
    # Hizli el testi
    from common import MLM
    m = MLM()
    tests = [
        ("She wrapped the gift in red paper.", "wrapped", "wrap", "VERB"),
        ("He secretly left the house at night.", "secretly", "secretly", "ADV"),
        ("The cat sat on the warm mat.", "warm", "warm", "ADJ"),
    ]
    for s, surf, lem, pos in tests:
        r = gate(m, s, surf, lem, pos)
        print(f"[{'GECTI' if r['pass'] else 'KALDI'}] {r['score']:.3f} {r['reason']:16s} | {surf} | {s}")
        print("   top:", ", ".join(f"{t}:{p}" for t, p in r["top10"][:6]))
