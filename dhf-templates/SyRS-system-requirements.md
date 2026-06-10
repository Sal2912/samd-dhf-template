# System Requirements Specification (SyRS)
**Document ID:** SyRS-001  
**Product:** {{PRODUCT_NAME}}  
**Version:** {{VERSION}}  
**Date:** {{DATE}}  
**Author:** {{AUTHOR}}  
**Status:** `Draft` | `In Review` | `Approved`  
**Approved By:** {{APPROVER}}  

---

## 1. General Information

| Field | Value |
|---|---|
| Product Name | {{PRODUCT_NAME}} |
| Product Version | {{PRODUCT_VERSION}} |
| Regulatory Class | {{REGULATORY_CLASS}} |
| Intended Use | {{INTENDED_USE}} |
| Intended User | {{INTENDED_USER}} |
| Use Environment | {{USE_ENVIRONMENT}} |
| Applicable Standards | ISO 13485, IEC 62304, ISO 14971, FDA 21 CFR Part 820 |
| Child Documents | SRS-001 (Software Requirements), RA-001 (Risk Analysis), TM-001 (Traceability Matrix) |

---

## 2. Purpose and Scope

This document defines the system-level requirements for {{PRODUCT_NAME}}. Requirements are organized by Epic (major feature area). Each Epic corresponds to a Jira Epic ticket in project `DHF`. System requirements at this level define **what the system must do** — software-level detail is captured in SRS-001.

**In scope:** {{SCOPE_IN}}  
**Out of scope:** {{SCOPE_OUT}}

---

## 3. System Context

### 3.1 System Overview
{{SYSTEM_OVERVIEW}}

### 3.2 System Interfaces

| Interface | Type | Description |
|---|---|---|
| {{INTERFACE_NAME}} | `User` \| `Hardware` \| `Software` \| `Network` | {{INTERFACE_DESC}} |

### 3.3 Assumptions and Constraints
- {{ASSUMPTION_1}}
- {{ASSUMPTION_2}}
- {{CONSTRAINT_1}}

---

## 4. System Requirements

> Requirements are grouped by Epic. Each Epic ID corresponds to a Jira Epic in project `DHF`. Stories under each Epic are child requirements captured in SRS-001.

---

### {{EPIC_ID_1}} — {{EPIC_TITLE_1}}

**Epic Description:** {{EPIC_DESCRIPTION_1}}  
**Priority:** `High` | `Medium` | `Low`  
**Status:** `Open` | `In Progress` | `Closed`  
**Jira Link:** {{EPIC_URL_1}}  

#### System Requirements

| Req ID | Requirement Statement | Type | Priority | Acceptance Criteria | Linked Stories |
|---|---|---|---|---|---|
| {{EPIC_ID_1}}-SYS-01 | {{SYS_REQ_STATEMENT}} | `Functional` \| `Safety` \| `Performance` \| `Interface` | `High` \| `Medium` \| `Low` | {{ACCEPTANCE_CRITERIA}} | {{LINKED_STORY_IDS}} |
| {{EPIC_ID_1}}-SYS-02 | {{SYS_REQ_STATEMENT}} | `Functional` \| `Safety` \| `Performance` \| `Interface` | `High` \| `Medium` \| `Low` | {{ACCEPTANCE_CRITERIA}} | {{LINKED_STORY_IDS}} |

---

### {{EPIC_ID_2}} — {{EPIC_TITLE_2}}

**Epic Description:** {{EPIC_DESCRIPTION_2}}  
**Priority:** `High` | `Medium` | `Low`  
**Status:** `Open` | `In Progress` | `Closed`  
**Jira Link:** {{EPIC_URL_2}}  

#### System Requirements

| Req ID | Requirement Statement | Type | Priority | Acceptance Criteria | Linked Stories |
|---|---|---|---|---|---|
| {{EPIC_ID_2}}-SYS-01 | {{SYS_REQ_STATEMENT}} | `Functional` \| `Safety` \| `Performance` \| `Interface` | `High` \| `Medium` \| `Low` | {{ACCEPTANCE_CRITERIA}} | {{LINKED_STORY_IDS}} |

<!-- Repeat Epic block for each Epic -->

---

## 5. Safety Requirements

| Req ID | Safety Requirement | Hazard Reference | Priority |
|---|---|---|---|
| SAF-001 | {{SAFETY_REQ}} | {{HAZARD_ID}} | High |

---

## 6. Regulatory Requirements

| Req ID | Regulation / Standard | Requirement | Compliance Evidence |
|---|---|---|---|
| REG-001 | {{STANDARD}} | {{REG_REQUIREMENT}} | {{EVIDENCE}} |

---

## 7. Revision History

| Version | Date | Author | Triggered By | Changes |
|---|---|---|---|---|
| 1.0 | {{DATE}} | {{AUTHOR}} | Initial | Initial release |
| {{VERSION}} | {{DATE}} | {{AUTHOR}} | {{EPIC_ID}} | {{CHANGE_SUMMARY}} |

---

*This document is updated when Jira Epics are closed. AI-assisted fields are marked `[AI]` and require human review and approval before the document status changes to Approved.*
