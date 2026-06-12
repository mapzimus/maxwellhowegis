"""gap_audit — fix-first data-gap detection, triage, and fix-tracking for the MA
Education Atlas.

The sweep is stateless (data -> findings); the registry is external memory that
findings are reconciled against. This package imports only from the *kept*
``compute_correlations`` module and vendors everything else it needs from the
soon-to-be-retired audit scripts, so retiring them cannot break it.

Run:  python -m scripts.analysis.gap_audit --help
"""

__version__ = "0.1.0"
