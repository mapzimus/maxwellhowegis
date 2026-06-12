"""CI invariant gate — pure comparison logic (testable without git)."""

from .config import NEVER_ACCEPTABLE


def gate_violations(current, prior_fps):
    """Findings that should fail CI: NEW (fp not in prior) + open/investigating +
    (high severity OR a never-acceptable invariant flag)."""
    return [
        f for f in current
        if f.fingerprint not in prior_fps
        and f.status in ("open", "investigating")
        and (f.severity == "high" or f.flag_code in NEVER_ACCEPTABLE)
    ]
