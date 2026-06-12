"""Put the repo root on sys.path so tests can import the package as
``scripts.analysis.gap_audit.*`` regardless of how pytest is invoked.
"""

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
