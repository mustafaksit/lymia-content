"""Klasik batch araclarinin ortak yollari.

ROOT  : repo koku
BATCH : qa/classics-batch-NN klasoru (CLASSICS_BATCH env, ornek: qa/classics-batch-02).
        Icinde batch-ids.json bulunur; kapi/inceleme/ses ciktilari buraya yazilir.
"""
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
V2 = ROOT / "content" / "v2"


def batch_dir() -> Path:
    raw = os.environ.get("CLASSICS_BATCH")
    if not raw:
        sys.exit("CLASSICS_BATCH ayarli degil (ornek: CLASSICS_BATCH=qa/classics-batch-02)")
    p = Path(raw)
    p = p if p.is_absolute() else ROOT / p
    if not (p / "batch-ids.json").exists():
        sys.exit(f"{p}/batch-ids.json yok")
    return p


def batch_ids() -> list[str]:
    return json.loads((batch_dir() / "batch-ids.json").read_text())
