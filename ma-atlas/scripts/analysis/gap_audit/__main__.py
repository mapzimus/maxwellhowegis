"""gap_audit CLI.

    python -m scripts.analysis.gap_audit --dump-tables     # table shapes (sanity)
    python -m scripts.analysis.gap_audit --emit-all        # full sweep -> registry + reports
    python -m scripts.analysis.gap_audit --check-gate      # CI invariant gate (exit code)
    python -m scripts.analysis.gap_audit --sync-issues     # mirror open-high to GitHub
    python -m scripts.analysis.gap_audit --build-manifest  # (re)generate provenance manifest
    python -m scripts.analysis.gap_audit --compat-report   # map new findings to old outputs

Only --dump-tables is wired up in this milestone; the rest are stubs.
"""

import argparse
import sys

from .tables import Tables


def cmd_dump_tables():
    t = Tables()
    cat = t.catalog
    d = t.district()
    m = t.muni()
    s = t.school()
    print(f"catalog metrics: {len(cat)}")
    print(f"  levels include district: {sum('district' in v['levels'] for v in cat.values())}")
    print(f"  levels include muni:     {sum('muni' in v['levels'] for v in cat.values())}")
    print(f"district: {d.shape}  | side files: {len(t.side_files())}")
    print(f"muni:     {m.shape}  | side files: {len(t.muni_side_files())}")
    print(f"school:   {s.shape}")
    for name in ("colleges", "private", "childcare"):
        r = t.reference(name)
        print(f"{name+':':10s}{r.shape}  | key={r.attrs.get('key')}")
    return 0


def cmd_compat_report():
    """Show the new tool reproduces the retired scripts' findings + the documented
    anomaly bugs. Run this before retiring audit_quality/audit_data/audit_coverage."""
    import csv
    import os
    from collections import Counter
    from . import config
    from .run import run_audit

    findings, _t, _m = run_audit(write=False)
    by_flag = Counter(f.flag_code for f in findings)
    print("=== gap_audit compatibility / coverage report ===")
    print(f"total findings: {len(findings)}")
    print("by flag:  " + ", ".join(f"{k}={v}" for k, v in by_flag.most_common()))
    print("by status:" + ", ".join(f" {k}={v}" for k, v in
                                    sorted(Counter(f.status for f in findings).items())))

    print("\ndata_anomalies.md critical-bug coverage:")
    print(f"  Bug 2 Gosnold zero-enrollment -> ZERO_ENROLLMENT x{by_flag.get('ZERO_ENROLLMENT', 0)}")
    print(f"  Bug 4 MHI $250k off-by-one    -> MHI_CEILING x{by_flag.get('MHI_CEILING', 0)}")
    print(f"  Bug 6 cohort sum > 1.0        -> COHORT_SUM x{by_flag.get('COHORT_SUM', 0)}")
    print(f"  Bug 1 regional HS absent      -> REGIONAL_HS_ABSENT x{by_flag.get('REGIONAL_HS_ABSENT', 0)} "
          f"(0 = already fixed in the data)")

    aq = os.path.join(config.ANALYSIS_DIR, "audit_quality.csv")
    print()
    if os.path.exists(aq):
        new_set = {(f.level, f.metric, f.flag_code) for f in findings}
        old_set = set()
        with open(aq, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                old_set.add((row["level"], row["metric"], row["code"]))
        missing = old_set - new_set
        print(f"parity vs audit_quality.csv: old={len(old_set)} "
              f"reproduced={len(old_set & new_set)} missing={len(missing)}")
        for x in sorted(missing)[:10]:
            print("   MISSING:", x)
        print("PARITY:", "PASS" if not missing else "MISMATCH")
    else:
        print("audit_quality.csv not present (already retired) — parity verified previously.")
    return 0


def cmd_check_gate():
    """Fail (exit 1) on any finding that is NEW since the committed registry and is
    high-severity or a never-acceptable invariant. Baseline (no committed registry)
    never gates. Reads the working-tree registry (written by a prior --emit-all)."""
    import json
    import os
    import subprocess
    from . import config, registry_io
    from .gate import gate_violations

    current = registry_io.read_registry()
    relpath = os.path.relpath(config.REGISTRY_PATH, config.ROOT).replace(os.sep, "/")
    prior_fps = set()
    try:
        r = subprocess.run(["git", "show", f"HEAD:{relpath}"],
                           capture_output=True, text=True, cwd=config.ROOT)
        if r.returncode == 0:
            prior_fps = {json.loads(ln)["fingerprint"]
                         for ln in r.stdout.splitlines() if ln.strip()}
    except Exception:
        pass

    if not prior_fps:
        print("gate: baseline (no committed registry) — recording without gating.")
        return 0

    violations = gate_violations(current, prior_fps)
    if violations:
        print(f"gate FAILED: {len(violations)} NEW high/invariant finding(s) since last commit:")
        for f in violations[:25]:
            print(f"  {f.severity:4s} {f.flag_code:16s} {f.level}/{f.metric} (scope {f.scope})")
        return 1
    print("gate passed: no new high-severity or invariant findings since last commit.")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m scripts.analysis.gap_audit")
    ap.add_argument("--dump-tables", action="store_true",
                    help="print entity-table shapes (sanity check vs. the old audits)")
    ap.add_argument("--emit-all", action="store_true",
                    help="run the full sweep and write registry + reports")
    ap.add_argument("--check-gate", action="store_true",
                    help="exit non-zero on invariant violations or new high-severity gaps")
    ap.add_argument("--sync-issues", action="store_true",
                    help="mirror open high-severity findings to GitHub issues")
    ap.add_argument("--build-manifest", action="store_true",
                    help="(re)generate the provenance manifest")
    ap.add_argument("--compat-report", action="store_true",
                    help="map new findings back to the retired scripts' outputs")
    ap.add_argument("--dry-run", action="store_true",
                    help="with --sync-issues: write a plan file, make no GitHub calls")
    args = ap.parse_args(argv)

    if args.dump_tables:
        return cmd_dump_tables()

    if args.build_manifest:
        import os
        from . import config
        from .provenance import manifest as M
        m = M.write_manifest()
        meta = m["_meta"]
        print(f"provenance manifest written to {os.path.relpath(config.MANIFEST_PATH, config.ROOT)}")
        print(f"  metrics resolved: {meta['metrics_resolved']}/{meta['metrics_total']} "
              f"({100*meta['metrics_resolved']//meta['metrics_total']}%)  "
              f"unresolved: {meta['metrics_unresolved']}  files: {meta['files_attributed']}")
        return 0

    if args.emit_all:
        import os
        from collections import Counter
        from . import config
        from .run import run_audit
        from . import report
        findings, _tables, _m = run_audit(write=True)
        report.write_reports(findings)
        by_status = Counter(f.status for f in findings)
        new_high = sum(1 for f in findings if f.is_new and f.severity == "high")
        print(f"swept {len(findings)} findings -> registry")
        print("  by status: " + ", ".join(f"{k}={v}" for k, v in sorted(by_status.items())))
        print(f"  open: {by_status.get('open', 0)}  |  new this run: "
              f"{sum(1 for f in findings if f.is_new)} (high: {new_high})  |  "
              f"resolved: {sum(1 for f in findings if f.is_resolved)}")
        for p in (config.REGISTRY_PATH, config.GAPS_MD, config.GAPS_CSV, config.MANIFEST_PATH):
            print(f"  wrote {os.path.relpath(p, config.ROOT)}")
        return 0

    if args.sync_issues:
        from .run import run_audit
        from . import issues, registry_io
        findings, _tables, _m = run_audit(write=True)
        result = issues.sync_issues(findings, dry_run=args.dry_run)
        registry_io.write_registry(findings)      # persist any new issue numbers
        print(f"issue sync: {result}")
        return 0

    if args.check_gate:
        return cmd_check_gate()

    if args.compat_report:
        return cmd_compat_report()

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
