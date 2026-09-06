"""
Quiz pipeline (Faz 3) ortak katman. SAF yardimcilar: annot envanteri, wordfreq
-> CEFR, MLM (masked LM) sarmalayici, cekim (lemminflect), WordNet iliski.

Vocab pipeline'ina (pipeline/vocab/) DOKUNMAZ; yalniz annot'u OKUR.
Model/veri pipeline/quiz/.hf-cache ve data/ altinda (gitignore).
"""
import os
import re
import json
import glob

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ANNOT_DIR = os.path.join(HERE, "..", "vocab", "cache", "annot")
DATA_DIR = os.path.join(HERE, "data")
CACHE_DIR = os.path.join(HERE, "cache")
OUT_DIR = os.path.join(REPO, "content", "v2", "quiz")
TATOEBA_TSV = os.path.join(DATA_DIR, "eng_sentences.tsv")

# HF model cache repo icinde (gitignore)
os.environ.setdefault("HF_HOME", os.path.join(HERE, ".hf-cache"))
os.environ.setdefault("TRANSFORMERS_CACHE", os.path.join(HERE, ".hf-cache"))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

MODEL_NAME = os.environ.get("QUIZ_MLM", "distilbert-base-uncased")

# ---- Esikler (parametre; raporlanir) ----
GATE_TOPK = 20
GATE_TARGET_IN_TOPN = 5      # hedef ilk N tahminde olmali
GATE_MIN_PROB = 0.05         # hedef olasiligi >= bu
SENT_MIN_WORDS = 6
SENT_MAX_WORDS = 22
PROPN_MAX_RATIO = 0.25
DISTRACTOR_MAX_PROB = 0.01   # celdirici [MASK] olasiligi <= bu
DISTRACTOR_RATIO = 0.10      # ve hedefin onda birinden kucuk
ZIPF_WINDOW = 1.0            # celdirici zipf hedefe +-1
MAX_SENTS_PER_LEMMA = 3
MAX_STORY_ATTEMPTS = 12      # sik lemma'larda yuzlerce occ'u gate'e sokma (hiz)

# ---- CEFR: wordfreq zipf esikleri (Oxford listesi yok -> siklik tabanli) ----
# zipf: 7=cok sik "the", 1=cok nadir. Esikler raporda.
def cefr_from_zipf(z):
    if z >= 5.5: return "A1"
    if z >= 4.8: return "A2"
    if z >= 4.0: return "B1"
    if z >= 3.2: return "B2"
    return "C1"

CEFR_ORDER = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4}

_word_re = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")

def words_of(text):
    return _word_re.findall(text)

def word_count(text):
    return len(words_of(text))

# ---- wordfreq ----
_zipf_cache = {}
def zipf(word):
    from wordfreq import zipf_frequency
    w = word.lower()
    if w not in _zipf_cache:
        _zipf_cache[w] = zipf_frequency(w, "en")
    return _zipf_cache[w]

# ---- Annot envanteri: lemma|pos -> gecisler ----
# POS: yalniz icerik kelimeleri (VERB/NOUN/ADJ/ADV); islev/ozel/sayi disi.
CONTENT_POS = {"VERB", "NOUN", "ADJ", "ADV"}

def story_ids():
    return sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(ANNOT_DIR, "*.json")))

def load_annot(story_id):
    with open(os.path.join(ANNOT_DIR, story_id + ".json"), encoding="utf-8") as f:
        return json.load(f)

def build_inventory(story_ids_list):
    """lemma\\tpos -> {lemma,pos,occ:[{storyId,level,p,s,text,surface,tag,propn_ratio}]}"""
    inv = {}
    for sid in story_ids_list:
        a = load_annot(sid)
        for level, d in a["levels"].items():
            for sent in d["sentences"]:
                toks = sent["tokens"]
                n = len(toks) or 1
                propn_ratio = sum(1 for t in toks if t.get("is_propn")) / n
                for t in toks:
                    if t["pos"] not in CONTENT_POS:
                        continue
                    if t.get("is_stop") or t.get("is_propn") or t.get("is_num"):
                        continue
                    key = t["lemma"] + "\t" + t["pos"]
                    e = inv.setdefault(key, {"lemma": t["lemma"], "pos": t["pos"], "occ": []})
                    e["occ"].append({
                        "storyId": sid, "level": level, "p": sent["p"], "s": sent["s"],
                        "text": sent["text"], "surface": t["surface"], "tag": t["tag"],
                        "propn_ratio": propn_ratio,
                    })
    return inv

# ---- lemminflect cekim ----
_UPOS = {"VERB": "VERB", "NOUN": "NOUN", "ADJ": "ADJ", "ADV": "ADV"}

def inflect(lemma, tag, pos):
    """lemma -> Penn tag'e gore cekim (lemminflect). Bulunamazsa lemma."""
    from lemminflect import getInflection
    forms = getInflection(lemma, tag=tag)
    if forms:
        return forms[0]
    return lemma

def all_forms(lemma, pos):
    """Bir lemma|pos icin tum yuzey bicimleri (Tatoeba eslemesi icin)."""
    from lemminflect import getAllInflections
    out = {lemma.lower()}
    infl = getAllInflections(lemma, upos=_UPOS.get(pos))
    for tag, forms in infl.items():
        for f in forms:
            out.add(f.lower())
    return out

# ---- WordNet iliski ----
_wn_ready = False
def _ensure_wn():
    global _wn_ready
    if _wn_ready:
        return
    import nltk
    try:
        nltk.data.find("corpora/wordnet")
    except LookupError:
        nltk.download("wordnet", quiet=True)
    try:
        nltk.data.find("corpora/omw-1.4")
    except LookupError:
        nltk.download("omw-1.4", quiet=True)
    _wn_ready = True

_WN_POS = {"VERB": "v", "NOUN": "n", "ADJ": "a", "ADV": "r"}

def wordnet_related(lemma, pos):
    """lemma ile es anlamli + hiper/hiponim lemma'lar (celdirici eleme)."""
    _ensure_wn()
    from nltk.corpus import wordnet as wn
    rel = set()
    wp = _WN_POS.get(pos)
    for syn in wn.synsets(lemma, pos=wp):
        for l in syn.lemmas():
            rel.add(l.name().lower().replace("_", " "))
        for r in syn.hypernyms() + syn.hyponyms():
            for l in r.lemmas():
                rel.add(l.name().lower().replace("_", " "))
    return rel

def same_root(a, b):
    """Ayni kok yakinligi: ilk 4 harf esit ve lemma farki kucuk."""
    a, b = a.lower(), b.lower()
    if a[:4] == b[:4] and abs(len(a) - len(b)) <= 3:
        return True
    return False

# ---- MLM (masked LM) ----
class MLM:
    def __init__(self, model_name=MODEL_NAME):
        import torch
        from transformers import AutoTokenizer, AutoModelForMaskedLM
        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForMaskedLM.from_pretrained(model_name)
        self.model.eval()
        self.mask = self.tok.mask_token

    def _mask_sentence(self, sentence, surface):
        """Cumlede surface'i (ilk tam-kelime eslemesi) [MASK] ile degistir."""
        pat = re.compile(r"\b" + re.escape(surface) + r"\b")
        if not pat.search(sentence):
            return None
        return pat.sub(self.mask, sentence, count=1)

    def predict(self, sentence, surface, top_k=GATE_TOPK):
        """[MASK] konumunda ilk top_k (token, prob). Yoksa []."""
        masked = self._mask_sentence(sentence, surface)
        if masked is None:
            return [], None
        return self._predict_masked(masked, top_k)

    def _predict_masked(self, masked, top_k):
        torch = self.torch
        enc = self.tok(masked, return_tensors="pt", truncation=True, max_length=64)
        with torch.no_grad():
            logits = self.model(**enc).logits[0]
        ids = enc["input_ids"][0]
        mask_pos = (ids == self.tok.mask_token_id).nonzero(as_tuple=True)[0]
        if len(mask_pos) == 0:
            return [], None
        probs = torch.softmax(logits[mask_pos[0]], dim=-1)
        top = torch.topk(probs, top_k)
        preds = [(self.tok.decode([i]).strip(), float(p)) for p, i in zip(top.values, top.indices)]
        return preds, probs

    def prob_of(self, masked_probs, word):
        """Verilen [MASK] olasilik dagiliminda bir kelimenin (ilk subword) olasiligi."""
        if masked_probs is None:
            return 0.0
        ids = self.tok(word, add_special_tokens=False)["input_ids"]
        if not ids:
            return 0.0
        return float(masked_probs[ids[0]])
