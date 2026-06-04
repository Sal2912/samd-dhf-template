---
title: "Verification and Validation"
section: verification-validation
version: 1.0
status: draft
owner: engineering
last_reviewed: 2026-06-03
review_interval_days: 60
tags: [vv, testing, iec-62304, usability]
linked_requirements: [REQ-001, REQ-002, REQ-003]
linked_hazards: [H-001, H-002, H-003]
---

# Verification and Validation

> V&V demonstrates that the device meets design inputs (verification) and user needs in the intended use environment (validation).

---

## 1. Verification Summary

| Test ID | Test Name | Linked Requirement | Method | Pass Criteria | Result | Date |
|---|---|---|---|---|---|---|
| TEST-001 | Unit tests — core algorithm | REQ-001 | Automated CI | 100% pass | [Pass/Fail] | [Date] |
| TEST-002 | Integration tests — API | REQ-001, REQ-003 | Automated CI | 100% pass | [Pass/Fail] | [Date] |
| TEST-003 | Security penetration test | REQ-003 | Third-party audit | Zero critical findings | [Pass/Fail] | [Date] |
| TEST-004 | Performance benchmark | REQ-002 | Dataset evaluation | >X% accuracy on validation set | [Pass/Fail] | [Date] |

---

## 2. Validation Summary

| Val ID | Validation Activity | User Population | Environment | Success Criteria | Result |
|---|---|---|---|---|---|
| VAL-001 | Usability study — formative | [HCP type, n=X] | Simulated use | Task completion >90% | [Pass/Fail] |
| VAL-002 | Clinical performance evaluation | [Patient population] | Real-world | [Clinical endpoint] | [Pass/Fail] |
| VAL-003 | Summative usability | [HCP type, n=X] | Simulated use | Zero critical use errors | [Pass/Fail] |

---

## 3. Test Coverage Matrix

| Requirement | Linked Test(s) | Coverage Status |
|---|---|---|
| REQ-001 | TEST-001, TEST-002 | Covered |
| REQ-002 | TEST-004 | Covered |
| REQ-003 | TEST-002, TEST-003 | Covered |

**Uncovered requirements (auto-flagged by CI):** `None` ← *This field is updated by the traceability check workflow*

---

## 4. Known Anomalies / Deviations

| ID | Description | Risk Impact | Disposition | Status |
|---|---|---|---|---|
| DEV-001 | [Description] | [Low/Med/High] | [Accepted / Fixed / Mitigated] | Open |

---

## 5. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
