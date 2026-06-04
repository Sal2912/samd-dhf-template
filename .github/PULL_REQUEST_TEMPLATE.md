## Summary

<!-- What does this PR do? 1–3 sentences. -->

## Type of Change

- [ ] Bug fix
- [ ] New feature / capability (task under a story)
- [ ] Algorithm / model change
- [ ] Data processing change
- [ ] Dependency update
- [ ] Refactor (no functional change)
- [ ] LaunchDarkly flag enable ← triggers DHF gate
- [ ] Documentation only

---

## Story & Task Tracking

<!--
  REQUIRED for all feature PRs.
  The DHF Sync Bot uses these fields to group task context under the right story.
  DHF documents are NOT updated on task PRs — only when the Jira story is marked Done.
-->

STORY: <!-- Jira story ID e.g. DHF-42 — the parent story this task belongs to -->
TASK:  <!-- Jira task ID e.g. DHF-87 — this specific task (leave blank if no task card) -->

---

## DHF Impact

<!--
  Fill this for every task that changes software behavior, inputs/outputs,
  algorithm logic, security, performance, or patient-facing functionality.

  This context is ACCUMULATED silently across all tasks in the story.
  Claude reads ALL task contexts together when the story is marked Done in Jira,
  then drafts a single coherent DHF update.

  Leave the entire ## DHF Impact section out ONLY for pure refactors or style changes.

  LAUNCHDARKLY FLAG ENABLE PRs:
  If this PR enables a LaunchDarkly flag, add:
    LAUNCHDARKLY_FLAG: <flag-key>
  The gate will block this PR until @Sal2912 has approved the DHF review Issue.
-->

CHANGE:           <!-- One sentence: what this task's code change does -->
CLINICAL_CONTEXT: <!-- What clinical scenario or user does this affect? -->
REQ:              <!-- REQ-XXX if updating existing · NEW if new requirement needed · leave blank if unsure -->
RISK:             <!-- H-XXX if updating existing · NEW if new risk · NONE with justification if no risk -->
TEST:             <!-- TEST-XXX once tests exist — can add later -->
RISK_JUSTIFICATION: <!-- Required if RISK: NONE — why does this task introduce no new hazard? -->
LAUNCHDARKLY_FLAG:  <!-- Flag key if this PR enables a LD flag — triggers DHF gate -->

---

## Testing

- [ ] Unit tests added or updated
- [ ] Integration tests pass
- [ ] No performance regression
- [ ] No new unreviewed dependency

## Merge Checklist

- [ ] STORY: field filled in
- [ ] DHF Impact context provided (or confirmed not applicable)
- [ ] CI passes
- [ ] If flag-enable PR: DHF review Issue approved by @Sal2912
