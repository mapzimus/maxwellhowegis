"""Run every registered layer checker and collect the raw findings.

Importing the checker modules here is what triggers their ``@register`` side
effects, so ``REGISTRY`` is populated by the time ``collect_raw`` runs.
"""

from .tables import Tables
from .checkers.base import REGISTRY
from .checkers import district as _district   # noqa: F401  (register side-effect)
from .checkers import muni as _muni           # noqa: F401  (register side-effect)
from .checkers import crosscol as _crosscol   # noqa: F401  (register side-effect)
from .checkers import coverage as _coverage   # noqa: F401  (register side-effect)
from .checkers import school as _school       # noqa: F401  (register side-effect)
from .checkers import reference as _reference  # noqa: F401  (register side-effect)


def collect_raw(tables=None):
    """Return (list[RawFinding], tables). Deterministic ordering by checker."""
    tables = tables or Tables()
    raws = []
    for checker in REGISTRY:
        if checker.applicable(tables):
            raws.extend(list(checker.check(tables)))
    return raws, tables
