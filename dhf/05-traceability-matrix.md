---
title: "Traceability Matrix"
section: traceability-matrix
version: 1.0
status: draft
owner: quality
last_reviewed: 2026-06-03
review_interval_days: 30
tags: [traceability, design-controls, audit-ready]
linked_requirements: [REQ-001, REQ-002, REQ-003]
linked_hazards: [H-001, H-002, H-003]
---

# Traceability Matrix

> This is the single source of truth connecting user needs → requirements → design outputs → hazards → tests. The CI traceability check validates this table on every push.

---

## Master Traceability Table

| User Need | Requirement | Design Output | Hazard | Risk Control | Test | Validation |
|---|---|---|---|---|---|---|
| UN-001 | REQ-001 | DO-001 | H-001 | RC-001 | TEST-001 | VAL-001 |
| UN-001 | REQ-002 | DO-002 | H-002 | RC-001 | TEST-004 | VAL-002 |
| UN-002 | REQ-003 | DO-003 | — | RC-002 | TEST-003 | VAL-001 |

---

## Traceability Rules (enforced by CI)

The automated traceability check (`scripts/check_traceability.py`) flags:

1. Any `REQ-XXX` in `dhf/03-design-inputs-outputs.md` that has no linked test in this matrix
2. Any `H-XXX` in `dhf/02-risk-management-file.md` that has no linked risk control
3. Any `TEST-XXX` that does not appear in `dhf/04-verification-validation.md`
4. Any row in this matrix where a cell is empty (gap in coverage)

CI will **fail the push** if gaps are found. Gaps must be resolved or explicitly documented with a waiver.

---

## Coverage Summary

> Auto-updated by `scripts/check_traceability.py` on each CI run.

| Metric | Count | Status |
|---|---|---|
| Total requirements | 3 | — |
| Requirements with linked tests | 3 | ✅ Full coverage |
| Total hazards | 3 | — |
| Hazards with risk controls | 2 | ⚠️ 1 uncovered |
| Total tests | 4 | — |
| Tests linked to requirements | 4 | ✅ Full coverage |

---

## Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
