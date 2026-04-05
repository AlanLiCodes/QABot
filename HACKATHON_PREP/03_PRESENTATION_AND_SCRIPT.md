# Presentation + Script (Judge Round)

## Suggested team roles
- Speaker 1: problem + product overview
- Speaker 2: live demo driver
- Speaker 3: architecture + impact + close

## 3-minute judge script

### 0:00-0:25 Problem
“QA is still one of the biggest bottlenecks before release. Teams either run manual checks, which are slow, or write brittle automation that is expensive to maintain for every new feature.”

### 0:25-0:45 Solution
“We built Kumqat, an AI QA teammate. You give it a URL and a plain-English requirement. It generates test cases, executes checks, and returns structured bug reports with confidence, severity, and evidence.”

### 0:45-1:55 Live demo
1. Open `/new-run`.
2. Enter target URL + requirement.
3. Click `Generate test cases` and briefly show generated cases.
4. Click `Run suite`.
5. Open run page and narrate live updates:
   - run started
   - case started/completed
   - status labels: pass/fail/blocked/flaky
6. Show one result card:
   - expected vs actual
   - suspected issue
   - repro steps
7. Show `Chat about this run` and ask one follow-up question.

### 1:55-2:35 Why this matters
“This compresses QA feedback cycles from hours to minutes. Teams get faster release confidence, clearer triage, and a shared source of truth for what broke and why.”

### 2:35-3:00 Close
“Kumqat combines autonomous execution, real-time visibility, and structured reporting in one workflow. It helps teams ship faster with fewer regressions. Thank you.”

## 5-minute version add-ons
- Show `/dashboard` for cross-run metrics.
- Show `/scheduled` for recurring checks.
- Show rerun failed flow from run page.

## Demo safety checklist (before walking on stage)
- API service is up and reachable.
- Frontend service is up and pointing at correct `QA_API_URL`.
- `GOOGLE_API_KEY` set.
- `BROWSER_USE_API_KEY` set.
- One known-good demo URL prepared.
- One backup demo URL prepared.
- At least one completed run already in history as fallback.

## If something fails live (recovery line)
“That’s actually a realistic QA scenario: external sites can block automation. Kumqat explicitly labels blocked vs failed, so teams know whether it’s a product defect or an access constraint.”
