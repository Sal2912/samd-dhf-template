# Traceability Matrix
**Document ID:** TM-001  
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
| Purpose | Bidirectional traceability from system requirements to tests |
| Applicable Standards | IEC 62304 §5.1, ISO 13485 §7.3, FDA Design Controls 21 CFR 820.30 |

---

## 2. Traceability Overview

This matrix links:
- **System Requirements** (SyRS) → **Software Requirements** (SRS/Jira Stories) → **Implementation** (GitHub PRs) → **Verification Tests** → **Risk Items** (RA)

Every row must have full left-to-right coverage. Gaps are highlighted as `⚠ Missing`.

---

## 3. Full Traceability Matrix

| Sys Req ID | SW Req ID (Jira) | Story Title | Epic ID | GitHub PR(s) | Test ID(s) | Hazard ID(s) | Verification Status | Notes |
|---|---|---|---|---|---|---|---|---|
| {{SYS_REQ_ID}} | {{STORY_ID}} | {{STORY_TITLE}} | {{EPIC_ID}} | {{PR_NUMBERS}} | {{TEST_IDS}} | {{HAZARD_IDS}} | `Pass` \| `Fail` \| `Pending` \| ⚠ Missing | {{NOTES}} |
| {{SYS_REQ_ID}} | {{STORY_ID}} | {{STORY_TITLE}} | {{EPIC_ID}} | {{PR_NUMBERS}} | {{TEST_IDS}} | {{HAZARD_IDS}} | `Pass` \| `Fail` \| `Pending` \| ⚠ Missing | {{NOTES}} |

---

## 4. Coverage Summary

| Category | Total | Traced | Coverage % |
|---|---|---|---|
| System Requirements → SW Requirements | {{TOTAL_SYS_REQS}} | {{TRACED_SYS_REQS}} | {{SYS_COVERAGE}}% |
| SW Requirements → Implementation (PRs) | {{TOTAL_SW_REQS}} | {{TRACED_TO_PR}} | {{PR_COVERAGE}}% |
| SW Requirements → Tests | {{TOTAL_SW_REQS}} | {{TRACED_TO_TESTS}} | {{TEST_COVERAGE}}% |
| SW Requirements → Risk Items | {{TOTAL_SW_REQS}} | {{TRACED_TO_RISK}} | {{RISK_COVERAGE}}% |

---

## 5. Gaps and Open Items

| Gap ID | Type | Description | Jira ID | Owner | Due Date | Status |
|---|---|---|---|---|---|---|
| GAP-001 | Missing Test | {{GAP_DESC}} | {{JIRA_ID}} | {{OWNER}} | {{DUE_DATE}} | `Open` \| `Resolved` |

---

## 6. Revision History

| Version | Date | Author | Triggered By | Changes |
|---|---|---|---|---|
| 1.0 | {{DATE}} | {{AUTHOR}} | Initial | Initial release |
| {{VERSION}} | {{DATE}} | {{AUTHOR}} | {{JIRA_ID}} | {{CHANGE_SUMMARY}} |

---

*This matrix is auto-maintained by the DHF Control sync system. Rows are added or updated when Jira stories close or GitHub PRs merge. All AI-populated fields are marked `[AI]` and require human review.*
