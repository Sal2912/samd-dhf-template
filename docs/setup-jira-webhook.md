# Setting Up the Jira Webhook

This is a one-time setup. After this, every time your team marks a Jira story
Done, the DHF Sync Bot fires automatically — no manual steps.

---

## What You Need First

Three GitHub Secrets must be set before the webhook works:

| Secret Name | What It Is | Where to Get It |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Haiku API key | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `JIRA_API_TOKEN` | Jira API token | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_EMAIL` | Your Atlassian account email | The email you log into Jira with |

Add all three at:
**github.com/Sal2912/samd-dhf-template → Settings → Secrets and variables → Actions**

---

## Step 1 — Create a GitHub Personal Access Token

The Jira webhook needs a token to call the GitHub API.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name: `GreyZone AI Jira Webhook`
4. Expiration: 1 year
5. Scopes: check **`repo`** (includes `repo:status`, `repo:dispatch`)
6. Click **Generate token**
7. Copy the token — save it securely (you cannot view it again)

---

## Step 2 — Configure the Jira Webhook

1. Go to **Jira admin**: `https://dhfgeneration.atlassian.net/plugins/servlet/webhooks`
   *(You need Jira admin access)*

2. Click **Create a WebHook**

3. Fill in:

   | Field | Value |
   |---|---|
   | **Name** | `GreyZone AI DHF Sync` |
   | **Status** | Enabled |
   | **URL** | `https://api.github.com/repos/Sal2912/samd-dhf-template/dispatches` |
   | **Secret** | *(leave blank)* |

4. Under **Headers**, add:
   ```
   Authorization: Bearer <YOUR_GITHUB_PAT_FROM_STEP_1>
   Content-Type: application/json
   ```

5. Under **Issue** events, check: **✅ updated**

6. Under **JQL Filter**, enter:
   ```
   project = DHF AND status changed to Done
   ```
   This ensures the webhook only fires when a DHF project story is marked Done.

7. Under **Payload**, set the body to:
   ```json
   {
     "event_type": "jira-story-done",
     "client_payload": {
       "story_id": "{{issue.key}}",
       "story_title": "{{issue.fields.summary}}",
       "story_status": "{{issue.fields.status.name}}"
     }
   }
   ```

8. Click **Save**

---

## Step 3 — Test It

**Option A — Jira test:**
1. Create a test story in Jira: `DHF-TEST-1`
2. Mark it Done
3. Check GitHub Actions tab — you should see `Jira Story Done — DHF Story Sync` running

**Option B — Manual trigger (no Jira needed):**
1. Go to your repo → **Actions** tab
2. Click `Jira Story Done — DHF Story Sync`
3. Click **Run workflow**
4. Enter a story ID (e.g. `DHF-1`)
5. Click **Run workflow**

---

## How the Full Flow Works After Setup

```
Engineer merges task PR
  → accumulate-task-context.yml runs silently
  → saves context to dhf/.story-context/DHF-42.json

(repeat for each task in the story)

Dev lead marks DHF-42 → Done in Jira
  → Jira fires webhook to GitHub
  → jira-story-done.yml triggers
  → Claude reads all task context
  → DHF documents updated (requirements, risk, traceability)
  → Review Issue opened → @Sal2912 notified

@Sal2912 reviews and comments "approved"
  → dhf-review-gate.yml runs
  → story context status → "dhf-approved"
  → Review Issue closed

Engineer opens flag-enable PR (LAUNCHDARKLY_FLAG: my-flag)
  → launchdarkly-flag-gate.yml checks story status
  → Status is "dhf-approved" → PR clears
  → Flag enabled → feature live
```

---

## Secrets Reference

| Secret | Used By | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude DHF drafting | Yes — bot uses placeholders without it |
| `JIRA_API_TOKEN` | Fetching story details from Jira | Yes — for richer Claude context |
| `JIRA_EMAIL` | Jira API authentication | Yes — paired with token |
| `GITHUB_TOKEN` | Auto-provided by Actions | Automatic — no setup needed |
