# Running DHF Control via GitHub Actions

Every push to `main` that touches `dhf-control/` automatically builds a Docker image,
pushes it to GitHub Container Registry (GHCR), and deploys it to your server over SSH.

---

## What you need

| Requirement | Where to get it |
|---|---|
| A server with Docker installed | Any VPS: DigitalOcean ($6/mo), Hetzner (€4/mo), AWS EC2 t3.micro free tier |
| SSH access to that server | Your hosting provider gives you a key pair on creation |
| Jira API token | [id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| GitHub PAT (read:repo) | [github.com/settings/tokens](https://github.com/settings/tokens) — classic, `read:repo` scope |

---

## Step 1 — Prepare your server

SSH into your server and run once:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Create the data directory (SQLite lives here, survives container restarts)
sudo mkdir -p /opt/dhf-data
sudo chown $USER /opt/dhf-data

# Allow GHCR pulls without auth (image is public)
# OR log in if you make the package private:
# echo $GITHUB_PAT | docker login ghcr.io -u Sal2912 --password-stdin
```

If you want the app reachable on port 80 (instead of :5000), add nginx:

```bash
sudo apt install -y nginx
sudo tee /etc/nginx/sites-enabled/dhf-control <<'NGINX'
server {
    listen 80;
    server_name your-server-ip-or-domain;
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX
sudo nginx -s reload
```

---

## Step 2 — Generate a deploy SSH key

On your **local machine** (or any machine, not the server):

```bash
ssh-keygen -t ed25519 -C "ghactions-deploy" -f ~/.ssh/ghactions_deploy -N ""
```

This gives you two files:
- `~/.ssh/ghactions_deploy` — **private key** → goes into GitHub Secrets
- `~/.ssh/ghactions_deploy.pub` — **public key** → goes onto the server

Add the public key to your server:
```bash
# On the server:
cat >> ~/.ssh/authorized_keys <<< "PASTE_PUBLIC_KEY_HERE"
```

---

## Step 3 — Add GitHub Secrets

Go to **[github.com/Sal2912/samd-dhf-template → Settings → Secrets and variables → Actions](https://github.com/Sal2912/samd-dhf-template/settings/secrets/actions)**
and add these secrets:

| Secret name | Value |
|---|---|
| `DEPLOY_HOST` | Your server's IP address or hostname |
| `DEPLOY_USER` | SSH username (e.g. `ubuntu`, `root`) |
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/ghactions_deploy` (the private key) |
| `JIRA_BASE_URL` | `https://dhfgeneration.atlassian.net` |
| `JIRA_EMAIL` | Your Atlassian login email |
| `JIRA_API_TOKEN` | Jira API token from Step 0 |
| `JIRA_PROJECT_KEY` | `DHF` |
| `DEPLOY_GITHUB_TOKEN` | GitHub PAT with `read:repo` scope |

> `GITHUB_TOKEN` is already built-in to Actions and handles pushing the Docker image —
> you don't need to set that one. `DEPLOY_GITHUB_TOKEN` is separate and only used by
> the running container to call the GitHub API for PR sync.

---

## Step 4 — Trigger the first deploy

**Option A — Push a change:**
Edit any file inside `dhf-control/` and push to `main`. The workflow starts automatically.

**Option B — Manual trigger:**
Go to [Actions → Deploy DHF Control UI → Run workflow](https://github.com/Sal2912/samd-dhf-template/actions/workflows/deploy-dhf-control.yml)
and click **Run workflow**.

Watch the logs — a green checkmark means the container is live.

---

## Checking the running container

On your server:
```bash
docker ps                         # confirm dhf-control is running
docker logs dhf-control --tail 50 # view recent logs
curl http://localhost:5000/api/stats  # health check
```

---

## Updating the app

Just push to `main`. The workflow:
1. Builds a new Docker image tagged with the commit SHA
2. Pushes to GHCR
3. SSHs into your server, stops the old container, starts the new one
4. SQLite data at `/opt/dhf-data/data.db` is untouched between deploys

---

## Rollback

```bash
# On the server — replace SHA with any previous commit hash
docker stop dhf-control && docker rm dhf-control
docker run -d \
  --name dhf-control \
  --restart unless-stopped \
  -p 5000:5000 \
  -v /opt/dhf-data:/data \
  -e JIRA_BASE_URL="https://dhfgeneration.atlassian.net" \
  -e JIRA_EMAIL="your@email.com" \
  -e JIRA_API_TOKEN="..." \
  -e GITHUB_TOKEN="..." \
  ghcr.io/sal2912/dhf-control:PREVIOUS_COMMIT_SHA
```
