"""Read/write registry.jsonl deterministically.

One finding per line, sorted by fingerprint, compact + sorted keys, UTF-8. Same
data + same date ⇒ byte-identical output, so reruns produce zero git diff and
concurrent edits from multiple machines merge cleanly (one self-contained line
each; the file carries `merge=union` in .gitattributes).
"""

import datetime
import json
import os

from .config import REGISTRY_PATH
from .finding import Finding


def today_str():
    return datetime.date.today().isoformat()      # date, not timestamp — no churn


def read_registry(path=REGISTRY_PATH):
    findings = []
    if not os.path.exists(path):
        return findings
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                findings.append(Finding.from_record(json.loads(line)))
    return findings


def serialize(findings):
    """Return the exact text that would be written (sorted, compact, UTF-8)."""
    recs = sorted((f.to_record() for f in findings), key=lambda r: r["fingerprint"])
    lines = [json.dumps(r, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
             for r in recs]
    return ("\n".join(lines) + "\n") if lines else ""


def write_registry(findings, path=REGISTRY_PATH):
    text = serialize(findings)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    return text
