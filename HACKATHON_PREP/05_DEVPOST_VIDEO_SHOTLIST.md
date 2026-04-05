# Devpost Video Shot List (2-3 minutes)

## Goal
Show a complete “input -> autonomous run -> actionable result” loop with minimal risk.

## Recording setup
- Record at 1080p.
- Close unrelated tabs/apps.
- Increase browser zoom slightly if text looks small.
- Keep one pre-completed run ready as backup.

## Timeline script

### 0:00-0:15 Problem + hook
- Slide or on-screen text:
  - “Manual QA is slow and expensive.”
  - “Kumqat turns requirements into live QA results.”

### 0:15-0:45 Create run
- Open `/new-run`.
- Enter URL + requirement.
- Click `Generate test cases`.
- Briefly highlight generated cases.

### 0:45-1:30 Execute + live stream
- Click `Run suite`.
- On run page, narrate:
  - live case progress
  - status categories (pass/fail/blocked/flaky)
  - summary bar

### 1:30-2:00 Result depth
- Open one completed result card.
- Show expected vs actual, suspected issue, repro steps.
- Mention confidence + severity.

### 2:00-2:25 Interactive mode
- Click `Chat about this run`.
- Ask one question:
  - “What failed and what should we fix first?”
- Show answer briefly.

### 2:25-2:50 Product breadth
- Quick cuts:
  - `/dashboard` metrics
  - `/scheduled` recurring runs
  - `/timings` performance insights

### 2:50-3:00 Close
- “Kumqat helps teams ship faster with clearer QA signals.”

## Backup plan if live run is slow
- Jump to a pre-completed run and narrate results as if run just finished.
- Keep this line ready:
  - “Even when execution conditions vary, Kumqat preserves a structured audit trail and triage workflow.”
