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
