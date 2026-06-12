"""The pluggable layer-checker contract.

Each layer (district, muni, school, colleges, private, childcare) implements
``LayerChecker`` and registers itself via ``@register``. A checker is pure: given
the ``Tables`` accessor it yields ``RawFinding``s with no side effects. Provenance
and lifecycle are attached later, by the driver/reconciler — not here.
"""

from abc import ABC, abstractmethod

from ..finding import RawFinding   # re-exported for checker modules

REGISTRY = []


def register(cls):
    """Class decorator: instantiate and add to the global checker REGISTRY."""
    REGISTRY.append(cls())
    return cls


class LayerChecker(ABC):
    level: str = None

    def applicable(self, tables) -> bool:    # cheap guard; override if a layer can be absent
        return True

    @abstractmethod
    def check(self, tables):
        """Yield RawFinding objects for this layer."""
        raise NotImplementedError


def slim_stat(st):
    """A small, rounded snapshot of col_stats for storage on a finding."""
    if not st:
        return None
    keep = ("n", "distinct", "min", "max", "mean",
            "top_share", "near_min_share", "near_max_share", "zero_share")
    out = {}
    for k in keep:
        if k in st:
            v = st[k]
            out[k] = round(v, 6) if isinstance(v, float) else v
    return out


__all__ = ["LayerChecker", "REGISTRY", "register", "RawFinding", "slim_stat"]
