# Devpost Draft (Kumqat)

## Project Name
Kumqat

## Tagline
From product requirement to live QA signal in minutes.

## Elevator Pitch (short)
Kumqat is an AI-powered QA teammate for web apps. Give it a URL and a plain-English requirement, and it generates test cases, runs autonomous checks, classifies outcomes, and returns actionable bug reports with evidence in a live dashboard.

## Inspiration
Manual QA is slow, repetitive, and often delayed until late in the release cycle. We wanted a tool that helps teams validate features continuously, without requiring deep testing expertise or writing test code from scratch every time.

## What it does
- Converts natural-language requirements into structured browser test cases.
- Runs automated checks on a target site and streams live progress.
- Classifies results as `pass`, `fail`, `blocked`, or `flaky`.
- Stores run history and enables rerunning failed/blocked cases.
- Provides analytics views (status distribution, severity trends, timing breakdowns).
- Supports an interactive chat flow for running and discussing test outcomes.

## How we built it
- Frontend: Next.js 15 + TypeScript + Tailwind.
- Backend: FastAPI + SQLModel + SQLite.
- Agent/AI stack:
  - Browser Use Cloud for autonomous browser flows.
  - Gemini APIs for test planning, validation, and discuss-mode Q&A.
- Real-time updates: Server-Sent Events (SSE) from backend to frontend.
- Scheduling: background recurring runs (hourly/daily/weekly).

## Challenges we ran into
- Designing reliable fallbacks when API keys are missing.
- Keeping live UI updates responsive with partial results.
- Balancing autonomous exploration with predictable, judge-demo-safe behavior.
- Making the output understandable for both technical and non-technical audiences.

## Accomplishments we’re proud of
- End-to-end flow from requirement -> execution -> structured reporting.
- Real-time streaming UX with progressive results.
- A complete product surface (run creation, history, analytics, schedules, chat/discuss).
- Strong demo readiness with clear, explainable outputs.

## What we learned
- Reliability and fallback behavior matter as much as model quality.
- Structured reporting is critical for trust in AI-assisted testing.
- Great demos require deliberate UX and narrative, not just model calls.

## What’s next
- Add robust local Playwright action execution and deterministic replay.
- Improve evidence capture (first-class local screenshots/video per step).
- Expand auth-aware testing with safe credential handling.
- Add CI/CD integrations (auto-run on pull requests and pre-release gates).

## Built With
- `next.js`
- `react`
- `typescript`
- `fastapi`
- `python`
- `sqlmodel`
- `sqlite`
- `browser-use`
- `gemini`
- `railway` (planned deployment)

## Optional 280-char summary
Kumqat turns plain-English requirements into live QA signals. It generates tests, runs autonomous browser checks, streams progress in real time, classifies failures, and gives teams a structured, actionable report they can use before release.
