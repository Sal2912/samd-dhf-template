---
title: "Design Inputs and Outputs"
section: design-inputs-outputs
version: 1.0
status: draft
owner: engineering
last_reviewed: 2026-06-03
review_interval_days: 60
tags: [design-controls, requirements, iec-62304]
linked_requirements: [REQ-001, REQ-002, REQ-003]
linked_hazards: [H-001, H-002]
---

# Design Inputs and Design Outputs

> Follows IEC 62304 software lifecycle and FDA Design Controls (21 CFR 820.30).

---

## 1. Design Inputs (Requirements)

> Design inputs are the physical and performance requirements used as a basis for device design.

| Req ID | Category | Requirement Statement | Source | Priority | Linked Hazard |
|---|---|---|---|---|---|
| REQ-001 | Functional | [The system shall...] | [User need / Standard / Regulation] | Must-have | H-001 |
| REQ-002 | Performance | [The system shall achieve X accuracy on Y dataset] | Clinical evidence | Must-have | H-002 |
| REQ-003 | Security | [The system shall encrypt data at rest using AES-256] | Cybersecurity guidance | Must-have | — |

**Requirement categories:** Functional | Performance | Interface | Security | Usability | Regulatory

---

## 2. Design Outputs

> Design outputs are the results of each design phase — architecture, code, algorithms, labeling.

| Output ID | Description | Type | Linked Requirement(s) | Version | Location |
|---|---|---|---|---|---|
| DO-001 | System architecture diagram | Document | REQ-001 | 1.0 | `docs/architecture.pdf` |
| DO-002 | Trained model artifact | Software | REQ-002 | v1.0 | `models/v1.0/` |
| DO-003 | API specification | Document | REQ-001, REQ-003 | 1.0 | `docs/api-spec.yaml` |

---

## 3. User Needs Traceability

| User Need | Linked Requirement(s) | Linked Test(s) | Status |
|---|---|---|---|
| [UN-001: Clinician needs accurate output] | REQ-002 | TEST-005 | Verified |
| [UN-002: Data must be secure] | REQ-003 | TEST-009 | Pending |

---

## 4. Design Transfer Checklist

- [ ] All design outputs have been reviewed and approved
- [ ] Manufacturing / deployment specifications are complete
- [ ] Labeling (IFU, release notes) matches intended use
- [ ] Design outputs are reproducible from documented inputs

---

## 5. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
