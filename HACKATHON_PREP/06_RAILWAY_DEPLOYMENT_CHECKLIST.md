# Railway Deployment Checklist (Kumqat)

## Deployment shape
Use **2 Railway services**:
- `kumqat-api` (FastAPI, Python)
- `kumqat-web` (Next.js)

This matches the current architecture and keeps frontend proxying clean.

## 1) Deploy `kumqat-api`

### Service config
- Root directory: `apps/api`
- Build source: `Dockerfile`
- Exposed port: `8000`

### Required environment variables
- `GOOGLE_API_KEY=<your_key>`
- `BROWSER_USE_API_KEY=<your_key>`
- `DATA_DIR=/data` (recommended for persistence)

### Recommended settings
- Mount Railway volume at `/data` so SQLite/artifacts survive restarts.
- Keep replicas at `1` for demo stability (in-memory SSE queue is per-instance).

### Health check
- Path: `/health`

## 2) Deploy `kumqat-web`

### Service config
- Root directory: `apps/web`
- Build command: `npm install && npm run build`
- Start command: `npm run start`

### Required environment variables
- `QA_API_URL=https://<kumqat-api-domain>`

### Optional env
- `SITE_PASSWORD=<password>` to enable basic-auth gate on all routes.

## 3) Networking notes
- Frontend calls `/api/qa/*` and proxies server-side to `QA_API_URL`.
- Because of proxying, browser CORS issues are minimized.
- If calling API directly from outside proxy, set `CORS_ORIGINS` on API accordingly.

## 4) Post-deploy smoke test
- Open web app `/new-run`.
- Run a small suite (3 cases) on a stable public URL.
- Confirm:
  - live stream updates on `/runs/{id}`
  - result cards render
  - `/dashboard` loads
  - `/scheduled` create/delete works
  - `/chat` run and discuss path work

## 5) Demo-day hardening
- Pre-run one suite to seed history.
- Keep backup URL and backup run ID.
- Verify both API keys are set before presentation.

Exact Railway deployment steps
Step 1 — Push to GitHub
Make sure your repo is on GitHub. If it's not yet:

cd /Users/study/Downloads/Hackathon/DiamondHacks2026/DiamondHacksTest/QABot
git init && git add . && git commit -m "initial commit"
# create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/kumqat.git
git push -u origin main

Step 2 — Create Railway project
Go to railway.app → sign in with GitHub → New Project
Click Deploy from GitHub repo → select your repo
Step 3 — API service
Railway auto-creates a service from your repo root. Change it:

Click the service → Settings → Source → set Root Directory to apps/api
Railway sees the Dockerfile and uses it automatically
Go to Variables → add:
GOOGLE_API_KEY = your key
BROWSER_USE_API_KEY = your key
PORT = 8000
Click Deploy. Wait for it to go green.
Go to Settings → Networking → Generate Domain — copy the URL (e.g. api-production-abc.up.railway.app)
Step 4 — Web service
In your Railway project → + New Service → GitHub repo → same repo
Settings → Source → Root Directory = apps/web
Railway detects Next.js via Nixpacks (no Dockerfile needed)
Go to Variables → add:
QA_API_URL = https://api-production-abc.up.railway.app (your API URL from step 3)
SITE_PASSWORD = pick a strong password (this is what judges enter)
Click Deploy. Wait for it to go green.
Settings → Networking → Generate Domain — copy the web URL
Step 5 — Connect them (CORS)
Go back to the API service → Variables → add:
CORS_ORIGINS = https://your-web-service.up.railway.app (the web URL from step 4)
Redeploy API (Railway does this automatically when vars change)
Step 6 — .Tech domain
In the web service → Settings → Networking → Custom Domain → add your .tech domain (e.g. kumqat.tech)
Railway shows you a CNAME value like your-web.up.railway.app
Log into your domain registrar (MLH gives domains via Namecheap):
Add a CNAME record: Name = @ (or www), Value = that Railway CNAME
TTL = 300
Back in Railway, click Verify — SSL is auto-provisioned (takes 1–5 min)
Update CORS_ORIGINS on the API service to https://kumqat.tech instead of the .up.railway.app URL
