# Setting Up the Claude API Key

The DHF Sync Bot uses **Claude Haiku** (Anthropic's fastest, most affordable model)
to draft regulatory-grade DHF content from pull request descriptions.

Estimated cost: **~$0.001–0.005 per PR** (fractions of a cent).

---

## Step 1 — Create an Anthropic Account

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up with your email (or log in if you have an account)
3. Add a payment method (required even for free-tier usage)

---

## Step 2 — Generate an API Key

1. In the Anthropic Console, click **API Keys** in the left sidebar
2. Click **Create Key**
3. Name it `GreyZone AI DHF Bot` (or anything recognizable)
4. Copy the key — it starts with `sk-ant-...`
5. Save it somewhere safe — you cannot view it again after closing the dialog

---

## Step 3 — Add the Key to GitHub

1. Go to your repo: `github.com/Sal2912/samd-dhf-template`
2. Click **Settings** (top nav)
3. In the left sidebar: **Secrets and variables → Actions**
4. Click **New repository secret**
5. Name: `ANTHROPIC_API_KEY`
6. Value: paste your `sk-ant-...` key
7. Click **Add secret**

That's it. The next PR you open will automatically use Claude.

---

## How the Bot Uses Claude

When a PR is opened:

1. The bot reads the `## DHF Impact` block from your PR description
2. It sends the PR title, description, and code diff to Claude Haiku
3. Claude drafts:
   - A precise, testable requirement statement ("The system shall...")
   - An ISO 14971-style hazard statement, hazardous situation, and potential harm
   - A regulatory risk justification (if no new risk)
   - A traceability rationale
   - A reasoning summary for the human reviewer
4. The bot writes Claude's drafts into the DHF documents
5. A GitHub Issue is opened for **@Sal2912** to review and approve
6. Merge is blocked until `approved` is commented on the Issue

---

## What Claude Haiku Costs

| Usage | Approximate Cost |
|---|---|
| 1 PR sync | ~$0.001–0.005 |
| 100 PRs/month | ~$0.10–0.50 |
| 1,000 PRs/month | ~$1.00–5.00 |

Anthropic provides $5 free credit on new accounts — enough for hundreds of bot runs.

---

## Fallback Behavior (No API Key)

If `ANTHROPIC_API_KEY` is not set, the bot still runs — it just inserts
`[REVIEW REQUIRED — Claude not configured]` placeholders instead of drafted content.
All automation (Issue creation, merge blocking, traceability updates) still works.
