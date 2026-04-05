# Judge Q&A Bank (High-probability questions)

## 1) What is the core innovation?
Kumqat closes the loop from requirement to executable QA signal. Instead of only generating test ideas, it runs checks, classifies outcomes, and gives structured, triage-ready results in one flow.

## 2) How is this different from normal test automation?
Traditional automation requires writing and maintaining scripts upfront. Kumqat starts from plain-English intent, then generates and executes test plans with a live, evidence-backed report.

## 3) How do you prevent hallucinated results?
We keep outputs structured (`pass/fail/blocked/flaky`, severity, confidence, expected vs actual, repro steps) and tie decisions to execution traces/evidence. We also include fallback paths and explicit blocked status.

## 4) What does “blocked” mean?
Blocked means the agent could not continue due to login walls, CAPTCHA, WAF/bot protection, or access restrictions. It is intentionally separated from product failures to reduce false defect reports.

## 5) How reliable is it without AI keys?
The product still runs with fallback behavior: template test generation and heuristic validation. AI keys improve depth/quality and unlock discuss-mode Q&A, but core run lifecycle still works.

## 6) Can this scale?
Yes, with architectural extensions:
- move from SQLite to managed Postgres
- move in-memory queues to Redis/pub-sub
- add distributed worker queues for run execution
- shard by domain/project

## 7) How do you handle security/privacy?
We avoid storing secrets in code, use env vars for keys, and separate blocked/auth states. For production, we’d add scoped credentials, audit logs, and stronger redaction of sensitive traces.

## 8) What are the main limitations today?
- Some sites block automation aggressively.
- Deterministic local browser step execution can be expanded further.
- Multi-instance horizontal scaling needs shared queue/state components.

## 9) Why should a team adopt this tomorrow?
It accelerates feedback loops and gives consistent QA reporting with much lower manual effort. Teams can quickly detect regressions and prioritize fixes with clearer impact context.

## 10) What would you build next if you had a month?
- PR/CI integration for automatic pre-merge checks
- richer media evidence and replay
- auth-aware workflows for protected app areas
- per-project policy controls and test governance
