"""The finding fingerprint and the registry record.

The fingerprint is the load-bearing primitive: a deterministic, machine-independent
digest of a finding's *identity* (not its values), so the same real-world problem
hashes to the same key across data refreshes and across machines — which is what
gives the registry memory. We use ``hashlib.sha1`` (NOT the builtin ``hash()``,
which is salted per-process via ``PYTHONHASHSEED``).

``RawFinding`` is what a checker emits (identity + severity + detail + a stat
snapshot). ``Finding`` is the persisted registry record: a RawFinding plus
provenance and the lifecycle fields.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Optional

# Unit-separator: a byte that cannot occur in a metric id / entity code, so the
# four identity components can never be ambiguously concatenated.
_SEP = "\x1f"


def make_fingerprint(level, metric, flag_code, scope, width: int = 12) -> str:
    """Deterministic 12-hex digest of (level, metric, flag_code, scope).

    Components are stripped so trailing/leading whitespace can't fork identity.
    """
    key = _SEP.join([
        str(level).strip(), str(metric).strip(),
        str(flag_code).strip(), str(scope).strip(),
    ])
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:width]


@dataclass(frozen=True)
class RawFinding:
    """What a layer checker emits. Identity + severity + detail + stat snapshot."""
    level: str
    metric: str
    flag_code: str
    scope: str            # entity code (e.g. "01090000") or "*" for metric-wide
    severity: str         # "high" | "med" | "low"
    detail: str
    stat: Optional[dict] = None

    def fingerprint(self, width: int = 12) -> str:
        return make_fingerprint(self.level, self.metric, self.flag_code, self.scope, width)


# Canonical order of the fields persisted to registry.jsonl.
RECORD_FIELDS = (
    "fingerprint", "level", "metric", "flag_code", "scope",
    "severity", "detail", "stat", "provenance",
    "first_seen", "last_seen", "status", "reason", "note",
    "github_issue", "history",
)


@dataclass
class Finding:
    """A persisted registry record (one JSONL line)."""
    fingerprint: str
    level: str
    metric: str
    flag_code: str
    scope: str
    severity: str
    detail: str
    stat: Optional[dict]
    provenance: Optional[dict]
    first_seen: str       # "YYYY-MM-DD" (date, not timestamp — avoids same-day churn)
    last_seen: str
    status: str           # one of config.STATUS_VALUES
    reason: Optional[str] = None
    note: Optional[str] = None          # human freeform; never auto-overwritten
    github_issue: Optional[int] = None
    history: list = field(default_factory=list)   # append-only [{date, event}]

    # Transient, per-run flags — never serialized, excluded from equality.
    is_new: bool = field(default=False, compare=False)
    is_resolved: bool = field(default=False, compare=False)

    # ── constructors ─────────────────────────────────────────────────────────
    @classmethod
    def from_raw(cls, raw: RawFinding, today: str, provenance=None,
                 status: str = "open") -> "Finding":
        return cls(
            fingerprint=raw.fingerprint(),
            level=raw.level, metric=raw.metric,
            flag_code=raw.flag_code, scope=raw.scope,
            severity=raw.severity, detail=raw.detail, stat=raw.stat,
            provenance=provenance,
            first_seen=today, last_seen=today,
            status=status,
            history=[{"date": today, "event": "opened"}],
        )

    @classmethod
    def from_record(cls, rec: dict) -> "Finding":
        return cls(
            fingerprint=rec["fingerprint"], level=rec["level"], metric=rec["metric"],
            flag_code=rec["flag_code"], scope=rec["scope"], severity=rec["severity"],
            detail=rec["detail"], stat=rec.get("stat"), provenance=rec.get("provenance"),
            first_seen=rec["first_seen"], last_seen=rec["last_seen"], status=rec["status"],
            reason=rec.get("reason"), note=rec.get("note"),
            github_issue=rec.get("github_issue"), history=list(rec.get("history", [])),
        )

    # ── serialization ────────────────────────────────────────────────────────
    def to_record(self) -> dict:
        """Ordered dict of the persisted fields only (excludes transient flags)."""
        return {
            "fingerprint": self.fingerprint, "level": self.level, "metric": self.metric,
            "flag_code": self.flag_code, "scope": self.scope, "severity": self.severity,
            "detail": self.detail, "stat": self.stat, "provenance": self.provenance,
            "first_seen": self.first_seen, "last_seen": self.last_seen,
            "status": self.status, "reason": self.reason, "note": self.note,
            "github_issue": self.github_issue, "history": self.history,
        }

    # ── helpers ──────────────────────────────────────────────────────────────
    def verify_fingerprint(self) -> bool:
        """The digest must be reconstructable from the stored identity fields."""
        return self.fingerprint == make_fingerprint(
            self.level, self.metric, self.flag_code, self.scope)

    def add_history(self, date: str, event: str) -> None:
        self.history.append({"date": date, "event": event})
