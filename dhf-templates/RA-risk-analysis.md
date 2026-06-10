# Risk Analysis
**Document ID:** RA-001  
**Product:** {{PRODUCT_NAME}}  
**Version:** {{VERSION}}  
**Date:** {{DATE}}  
**Author:** {{AUTHOR}}  
**Status:** `Draft` | `In Review` | `Approved`  
**Approved By:** {{APPROVER}}  
**Standard:** ISO 14971:2019  

---

## 1. General Information

| Field | Value |
|---|---|
| Product Name | {{PRODUCT_NAME}} |
| Product Version | {{PRODUCT_VERSION}} |
| Regulatory Class | {{REGULATORY_CLASS}} |
| Risk Management Process Owner | {{OWNER}} |
| Applicable Standards | ISO 14971:2019, IEC 62304, FDA Guidance on Software as Medical Device |

---

## 2. Scope

This document identifies, estimates, and evaluates risks associated with {{PRODUCT_NAME}}. It is updated when stories or epics introduce changes that may affect patient safety, data integrity, or system reliability.

**Risk Acceptance Criteria:**  
- Residual risk is acceptable when probability × severity score ≤ {{RISK_THRESHOLD}}  
- All HIGH severity risks require explicit mitigation regardless of probability

---

## 3. Severity and Probability Definitions

### Severity Scale

| Level | Score | Definition |
|---|---|---|
| Catastrophic | 5 | Death or permanent impairment |
| Critical | 4 | Serious injury or irreversible harm |
| Serious | 3 | Requires medical intervention |
| Minor | 2 | Temporary or reversible harm |
| Negligible | 1 | No injury, inconvenience only |

### Probability Scale

| Level | Score | Definition |
|---|---|---|
| Frequent | 5 | Likely to occur in most uses |
| Probable | 4 | Likely to occur in some uses |
| Occasional | 3 | Could occur in some uses |
| Remote | 2 | Unlikely but possible |
| Improbable | 1 | So unlikely it can be ignored |

### Risk Level Matrix

| | Negligible (1) | Minor (2) | Serious (3) | Critical (4) | Catastrophic (5) |
|---|---|---|---|---|---|
| **Frequent (5)** | Medium | High | High | Critical | Critical |
| **Probable (4)** | Low | Medium | High | High | Critical |
| **Occasional (3)** | Low | Medium | Medium | High | High |
| **Remote (2)** | Low | Low | Medium | Medium | High |
| **Improbable (1)** | Low | Low | Low | Low | Medium |

---

## 4. Risk Register

> Risks are grouped by Epic/feature area. Story-level changes that introduce new or modified risks are added as new rows with their Jira ID as the source reference.

| Hazard ID | Source (Jira ID) | Hazard Description | Hazardous Situation | Harm | Severity | Probability | Risk Level | Mitigation | Residual Risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| H-001 | {{EPIC_OR_STORY_ID}} | {{HAZARD_DESC}} | {{HAZARDOUS_SITUATION}} | {{HARM}} | {{SEVERITY_SCORE}} | {{PROB_SCORE}} | {{RISK_LEVEL}} | {{MITIGATION}} | {{RESIDUAL_RISK}} | `Open` \| `Mitigated` \| `Accepted` |
| H-002 | {{EPIC_OR_STORY_ID}} | {{HAZARD_DESC}} | {{HAZARDOUS_SITUATION}} | {{HARM}} | {{SEVERITY_SCORE}} | {{PROB_SCORE}} | {{RISK_LEVEL}} | {{MITIGATION}} | {{RESIDUAL_RISK}} | `Open` \| `Mitigated` \| `Accepted` |

---

## 5. AI-Assisted Risk Evaluation

> The following risks were identified or updated by Claude Haiku based on story/epic context. All entries marked `[AI]` require human review.

| Story ID | AI Assessment | Confidence | Reviewer Decision | Reviewer |
|---|---|---|---|---|
| {{STORY_ID}} | `[AI]` {{AI_RISK_SUMMARY}} | `High` \| `Medium` \| `Low` | `Accepted` \| `Rejected` \| `Modified` | {{REVIEWER}} |

---

## 6. Risk-Benefit Summary

{{RISK_BENEFIT_SUMMARY}}

---

## 7. Revision History

| Version | Date | Author | Triggered By | Changes |
|---|---|---|---|---|
| 1.0 | {{DATE}} | {{AUTHOR}} | Initial | Initial release |
| {{VERSION}} | {{DATE}} | {{AUTHOR}} | {{JIRA_ID}} | {{CHANGE_SUMMARY}} |

---

*This document is maintained by the DHF Control system. AI-assisted risk entries are marked `[AI]` and require human review and approval before the document status can change to Approved.*
