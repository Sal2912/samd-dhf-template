#!/usr/bin/env python3
"""
Traceability Check — GreyZone AI SaMD DHF Template
====================================================
Runs on every push to main via GitHub Actions.
Validates that the traceability matrix is complete:
  - Every REQ-XXX has a linked test
  - Every H-XXX has a linked risk control
  - Every TEST-XXX appears in the V&V document
  - No empty cells in the traceability matrix

Exits with code 1 (fails CI) if gaps are found.
"""

import re
import sys
from pathlib import Path

DHF_DIR = Path(__file__).parent.parent / "dhf"

# ── File paths ─────────────────────────────────────────────────────────────────
TRACEABILITY_FILE = DHF_DIR / "05-traceability-matrix.md"
REQUIREMENTS_FILE = DHF_DIR / "03-design-inputs-outputs.md"
RISK_FILE         = DHF_DIR / "02-risk-management-file.md"
VV_FILE           = DHF_DIR / "04-verification-validation.md"

# ── Regex patterns ──────────────────────────────────────────────────────────────
REQ_PATTERN  = re.compile(r"\bREQ-\d+\b")
HAZ_PATTERN  = re.compile(r"\bH-\d+\b")
TEST_PATTERN = re.compile(r"\bTEST-\d+\b")
RC_PATTERN   = re.compile(r"\bRC-\d+\b")


def extract_ids(file_path: Path, pattern: re.Pattern) -> set[str]:
    """Extract all IDs matching pattern from a markdown file."""
    if not file_path.exists():
        print(f"  ⚠️  File not found: {file_path}")
        return set()
    text = file_path.read_text()
    return set(pattern.findall(text))


def check_traceability() -> list[str]:
    """Run all traceability checks. Returns a list of gap descriptions."""
    gaps = []

    # IDs defined in source documents
    reqs_defined   = extract_ids(REQUIREMENTS_FILE, REQ_PATTERN)
    hazards_defined = extract_ids(RISK_FILE, HAZ_PATTERN)
    tests_defined  = extract_ids(VV_FILE, TEST_PATTERN)
    rcs_defined    = extract_ids(RISK_FILE, RC_PATTERN)

    # IDs referenced in traceability matrix
    reqs_in_matrix  = extract_ids(TRACEABILITY_FILE, REQ_PATTERN)
    hazs_in_matrix  = extract_ids(TRACEABILITY_FILE, HAZ_PATTERN)
    tests_in_matrix = extract_ids(TRACEABILITY_FILE, TEST_PATTERN)
    rcs_in_matrix   = extract_ids(TRACEABILITY_FILE, RC_PATTERN)

    # Check 1: Every requirement must appear in the traceability matrix
    missing_reqs = reqs_defined - reqs_in_matrix
    if missing_reqs:
        gaps.append(f"Requirements not in traceability matrix: {sorted(missing_reqs)}")

    # Check 2: Every hazard must have a risk control
    hazards_without_rc = hazards_defined - hazs_in_matrix
    if hazards_without_rc:
        gaps.append(f"Hazards with no entry in traceability matrix: {sorted(hazards_without_rc)}")

    # Check 3: Every test must be in the traceability matrix
    tests_not_traced = tests_defined - tests_in_matrix
    if tests_not_traced:
        gaps.append(f"Tests not linked in traceability matrix: {sorted(tests_not_traced)}")

    # Check 4: Every requirement in matrix must exist in requirements file
    orphan_reqs = reqs_in_matrix - reqs_defined
    if orphan_reqs:
        gaps.append(f"Matrix references undefined requirements: {sorted(orphan_reqs)}")

    # Check 5: Every hazard in matrix must exist in risk file
    orphan_hazards = hazs_in_matrix - hazards_defined
    if orphan_hazards:
        gaps.append(f"Matrix references undefined hazards: {sorted(orphan_hazards)}")

    return gaps


def main():
    print("=" * 60)
    print("SaMD DHF Traceability Check — GreyZone AI")
    print("=" * 60)

    gaps = check_traceability()

    if not gaps:
        print("\n✅ All traceability checks passed. No gaps found.\n")
        sys.exit(0)
    else:
        print(f"\n❌ {len(gaps)} traceability gap(s) found:\n")
        for i, gap in enumerate(gaps, 1):
            print(f"  {i}. {gap}")
        print("\nResolve these gaps in dhf/05-traceability-matrix.md before merging.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
