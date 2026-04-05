# kumQAt (DiamondHacks 2026)

Autonomous browser QA: **natural-language requirements → generated test cases → HTTP + Browser Use runs → Gemini validation → structured reports** — streamed live over SSE.

## Stack

| Layer | Tech |
|--------|------|
| **Dashboard** | Next.js 15 (`apps/web`) — About, New Run, Scheduled, Dashboard, Results, Timings, Chat |
| **API** | FastAPI (`apps/api`), title **Kumqat API** |
| **Data** | SQLModel + **SQLite** (`DATA_DIR/qa_engineer.db`) |
| **Artifacts** | `DATA_DIR/artifacts/{run_id}/` (agent traces, optional local screenshots); static mount **`GET /files/...`** |
| **LLM** | **Google Gemini** via `GOOGLE_API_KEY` (`google-genai`) — test planning, result validation, run **Discuss**, vision-based screenshot annotation |
| **Browser agent** | **Browser Use Cloud** (`BROWSER_USE_API_KEY`, `browser-use-sdk`) when set; optional local **browser-use** + **langchain-google-genai** if installed |

Default Gemini model IDs in code include **`gemini-3-flash-preview`** (validator, local agent). Cloud tasks use **`BROWSER_USE_CLOUD_LLM`** (default `gemini-3-flash-preview`). Override with env vars such as `GEMINI_VALIDATOR_MODEL`, `GEMINI_PLANNER_MODEL`, `GEMINI_AGENT_MODEL`.

## Environment variables (`apps/api/.env`)

| Variable | Role |
|----------|------|
| **`GOOGLE_API_KEY`** | **Recommended.** Planner (generated tests), validator, `/discuss`, annotator. If missing: template test cases, heuristic validation, Discuss/chat Q&A disabled or degraded. |
| **`BROWSER_USE_API_KEY`** | **Recommended for real browsing.** Creates cloud browser sessions (live view URL over SSE), agent tasks, per-step screenshots (`highlight_elements`). If missing: HTTP-only smoke via **httpx** unless optional local browser-use is installed. |

Optional:

- **`DATA_DIR`** — Root for DB + artifacts (default: `apps/api/data`). Use on Railway/hosted volumes.
- **`CORS_ORIGINS`** — Comma-separated allowed origins (default includes `localhost:3000`).

See `apps/api/.env.example` for the committed template (no secrets).

## Quick start

### 1. API

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Optional local Browser Use agent: uncomment browser-use + playwright in requirements.txt, then:
#   pip install browser-use playwright && playwright install chromium
# Create apps/api/.env with at least GOOGLE_API_KEY; add BROWSER_USE_API_KEY for cloud agent runs.
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Web

```bash
cd apps/web
npm install
# Optional: echo 'QA_API_URL=http://127.0.0.1:8000' > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app calls **`/api/qa/*`** on the Next server, which proxies to FastAPI (default **`http://127.0.0.1:8000`**).

### 3. Monorepo (from repo root)

```bash
npm install
npm run dev:api    # terminal 1
npm run dev:web    # terminal 2
```

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `POST` | `/generate-tests` | URL + requirement → JSON test cases (`max_cases` default **5**, max **12**) |
| `POST` | `/run-suite` | Queue a suite (`test_cases` optional, `viewport`, `max_cases`) |
| `POST` | `/run-test` | Queue a single `test_case` |
| `GET` | `/stream/{run_id}` | **SSE** — run/case progress, optional **`case_live_url`** (Browser Use Cloud) |
| `POST` | `/chat-run` | Chat-style single run (streaming-friendly) |
| `GET` | `/results/{run_id}` | Run metadata + per-case results |
| `GET` | `/runs` | Recent runs |
| `GET` | `/stats` | Aggregated metrics for the dashboard |
| `GET` | `/config-status` | Whether keys are configured (for UI hints) |
| `POST` | `/rerun-failed` | New run from failed/flaky/blocked cases |
| `POST` | `/discuss` | Gemini Q&A over a run (**503** if no `GOOGLE_API_KEY`) |
| `POST` | `/schedule-run` | Create **hourly / daily / weekly** scheduled run |
| `GET` | `/scheduled-runs` | List schedules |
| `DELETE` | `/scheduled-runs/{schedule_id}` | Remove a schedule |
| `GET` | `/timings` | Timing aggregates |
| `GET` | `/timings/{run_id}` | Per-run timing detail |
| `GET` | `/export/{run_id}.json` | Full JSON export |
| `GET` | `/files/...` | Artifact files |

**Data layout:** `DATA_DIR/qa_engineer.db` (runs, stored cases, results, **`scheduledrun`**). **Artifacts:** `DATA_DIR/artifacts/{run_id}/{case_id}/` (e.g. `agent_trace.txt`).

**Background scheduler:** On startup, a loop every **30s** checks **`ScheduledRun`** rows and starts due runs (scheduled path currently seeds cases with **`max_cases=5`** in `main.py`).

**Concurrency:** Up to **3** test cases execute in parallel per run (`orchestrator.py`).

## Execution model (per case)

1. **HTTP smoke** — `httpx` GET, status/title/final URL, basic bot/WAF hints.  
2. If Browser Use is available — **cloud** (session + task + step screenshots) or **local** Gemini agent; trace written to `agent_trace.txt` and linked in evidence.  
3. **Validator** — Gemini JSON classification when keyed, else heuristics.  
4. **Annotator** — On non-pass, optional Gemini Vision box on **`viewport.png`** if that file exists (skipped silently otherwise).

The results UI can show **`.webm`** recordings and **HTTPS screenshot URLs** when they appear in `evidence`.

## SSE event types (representative)

| `type` | Notes |
|--------|--------|
| `run_started` | `{ run_id, total }` |
| `case_started` | `{ case_id, name, index }` |
| `case_live_url` | `{ case_id, live_url }` — Browser Use Cloud live session |
| `case_completed` | `{ case_id, status, severity, summary, evidence, timings }` |
| `run_completed` | `{ run_id, status, elapsed_seconds }` |

## Web routes

| Path | Purpose |
|------|---------|
| `/` | Product / about |
| `/new-run` | Generate cases + start run |
| `/scheduled` | Manage scheduled runs |
| `/dashboard` | Stats and charts |
| `/runs`, `/runs/[runId]` | History + live/streaming results |
| `/timings` | Performance views |
| `/chat` | Interactive scenario + streaming run |

## Demo tip

Use a stable public URL first. Sites with aggressive WAF/CAPTCHA may classify as **blocked**. Logins and MFA are not automated unless you extend the runner.

## License / attribution

DiamondHacks 2026 · **kumQAt**
