# Kumqat: Project Truth Brief (for judges + team alignment)

## One-line summary
Kumqat is an AI-assisted web QA tool that turns a plain-English requirement into test cases, runs automated checks against a target URL, classifies outcomes (`pass/fail/blocked/flaky`), and presents evidence in a live dashboard.

## What is implemented right now
- FastAPI backend with async run orchestration and SSE streaming (`/stream/{run_id}`).
- Next.js frontend with:
  - new run creation
  - live results page
  - interactive chat-run mode
  - analytics dashboard
  - scheduled recurring runs
- Test case generation with Gemini when `GOOGLE_API_KEY` exists; fallback templates when missing.
- Result validation with Gemini when `GOOGLE_API_KEY` exists; heuristic fallback when missing.
- Browser Use Cloud execution when `BROWSER_USE_API_KEY` exists.
- Persistence in SQLite (`DATA_DIR/qa_engineer.db`) and artifact files under `DATA_DIR/artifacts`.

## Important environment switches
- `GOOGLE_API_KEY`:
  - enables LLM planner + validator + `/discuss` run Q&A.
  - without it: fallback generation/validation and `/discuss` returns 503.
- `BROWSER_USE_API_KEY`:
  - enables Browser Use Cloud agent path.
  - without it: HTTP smoke-only execution path.

## Judge-safe claims (use these)
- “We support live run streaming via SSE.”
- “Runs are persisted and browsable with history, reruns, export, and analytics.”
- “Classification is structured into pass/fail/blocked/flaky with severity and confidence.”
- “We support both autonomous run mode and interactive chat mode.”

## Claims to avoid unless you patch first
- “Every case records a local Playwright video/screenshot.”
- “We always execute full multi-step UI interactions locally with Playwright.”

Current code primarily does an HTTP baseline + Browser Use Cloud (when key exists). UI supports media evidence, but local `.webm`/`.png` generation is not currently guaranteed in this branch.

## Recommended demo posture
- Use a public site that is less likely to CAPTCHA hard-block.
- Keep one clear requirement and run 3-5 cases.
- Emphasize:
  - live progress
  - structured outputs
  - discuss mode for post-run reasoning
  - rerun failed/blocked flows

## Naming consistency
Use **Kumqat** in the presentation and Devpost (this is what the UI and navbar currently show).
