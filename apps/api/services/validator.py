import json
import os
from typing import Any

from models.schemas import TestCase, TestResultPayload

VALIDATOR_SYSTEM = """You are a QA validator. Given a test case, executor trace, page metadata, and evidence paths,
classify outcome as pass, fail, flaky, or blocked.
Output ONLY JSON with keys: status, severity (low|medium|high), confidence (0-1), failed_step (string or null),
expected (short), actual (short), repro_steps (array of strings), suspected_issue, business_impact.
blocked = login/MFA/captcha missing. fail = clear unmet expectation. pass = criteria reasonably met."""


async def validate_result(
    case: TestCase,
    trace: str,
    page_title: str,
    final_url: str,
    evidence: list[str],
    http_ok: bool,
) -> TestResultPayload:
    key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if key:
        model = os.getenv("GEMINI_VALIDATOR_MODEL", "gemini-2.0-flash")
        user = json.dumps(
            {
                "test_case": case.model_dump(),
                "agent_trace": trace[:12000],
                "page_title": page_title,
                "final_url": final_url,
                "evidence": evidence,
                "http_reachable": http_ok,
            },
            ensure_ascii=False,
        )
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=key)
            response = client.models.generate_content(
                model=model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=VALIDATOR_SYSTEM,
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            raw = json.loads(response.text or "{}")
            return _payload_from_dict(case.id, raw, trace)
        except Exception:
            pass  # fall through to heuristic

    return _heuristic_validate(case, trace, page_title, final_url, evidence, http_ok)


def _payload_from_dict(case_id: str, raw: dict[str, Any], trace: str) -> TestResultPayload:
    status = raw.get("status", "fail")
    if status not in ("pass", "fail", "flaky", "blocked"):
        status = "fail"
    sev = raw.get("severity", "medium")
    if sev not in ("low", "medium", "high"):
        sev = "medium"
    return TestResultPayload(
        test_case_id=case_id,
        status=status,
        severity=sev,
        confidence=float(raw.get("confidence", 0.7)),
        failed_step=raw.get("failed_step"),
        expected=str(raw.get("expected", "")),
        actual=str(raw.get("actual", "")),
        repro_steps=list(raw.get("repro_steps") or []),
        evidence=[],
        suspected_issue=str(raw.get("suspected_issue", "")),
        business_impact=str(raw.get("business_impact", "")),
        agent_trace=trace,
    )


def _extract_error_line(trace: str) -> str:
    """Pull the first BLOCKED/NETWORK ERROR/PLAYWRIGHT ERROR line from the trace."""
    for line in trace.splitlines():
        for prefix in ("BLOCKED:", "NETWORK ERROR:", "PLAYWRIGHT ERROR:", "SERVER ERROR:", "HTTP ERROR:"):
            if line.strip().startswith(prefix):
                return line.strip()
    return ""


def _heuristic_validate(
    case: TestCase,
    trace: str,
    page_title: str,
    final_url: str,
    evidence: list[str],
    http_ok: bool,
) -> TestResultPayload:
    tl = trace.lower()

    # ── Bot / WAF block ──────────────────────────────────────────────────────
    bot_markers = (
        "blocked:", "captcha", "mfa", "2fa", "login required",
        "authentication required", "verify you are human",
        "cloudflare", "ddos protection", "bot detection", "access denied",
        "429 too many", "403 forbidden",
    )
    if any(m in tl for m in bot_markers):
        error_line = _extract_error_line(trace) or "Bot-challenge or auth wall detected in page content."
        return TestResultPayload(
            test_case_id=case.id,
            status="blocked",
            severity="medium",
            confidence=0.70,
            failed_step="Load target page",
            expected="; ".join(case.expected_outcomes[:2]) or case.goal,
            actual=error_line,
            repro_steps=case.steps[:5] if case.steps else [f"Open {final_url}"],
            evidence=evidence,
            suspected_issue=(
                "Site is blocking automated browsers (Cloudflare, CAPTCHA, WAF, or rate limit). "
                "The Browser Use Cloud agent may be able to bypass this — check the agent trace."
            ),
            business_impact="Automated QA cannot verify this flow without bypassing bot protection.",
            agent_trace=trace,
        )

    # ── Network / navigation failure ─────────────────────────────────────────
    if not http_ok or not page_title.strip():
        error_line = _extract_error_line(trace) or "Navigation failed or page returned no content."
        # Try to infer a more specific cause from the trace
        if "dns" in tl or "name_not_resolved" in tl or "name_not_found" in tl:
            suspected = "DNS resolution failed — check that the URL is correct and the domain exists."
            impact = "The domain cannot be reached; users would see a browser error page."
        elif "refused" in tl:
            suspected = "Connection refused — the server may be down or the port is not open."
            impact = "Service is unreachable on this address."
        elif "timed out" in tl or "timeout" in tl:
            suspected = "Connection timed out — the server is slow, overloaded, or blocking headless traffic."
            impact = "Users on slow networks may also experience timeouts."
        elif "ssl" in tl or "tls" in tl:
            suspected = "SSL/TLS handshake error — certificate may be invalid or expired."
            impact = "Browsers will show a security warning; most users will not proceed."
        elif "invalid url" in tl:
            suspected = "Malformed URL — ensure it includes a valid scheme (https://)."
            impact = "No users can reach this address as-is."
        else:
            suspected = "Network error or blocking response — see agent trace for details."
            impact = "Users may be unable to access the application."
        return TestResultPayload(
            test_case_id=case.id,
            status="fail",
            severity="high",
            confidence=0.75,
            failed_step="Load target page",
            expected="Page loads with HTTP 2xx and visible title",
            actual=error_line,
            repro_steps=case.steps[:5] if case.steps else [f"Open {final_url}"],
            evidence=evidence,
            suspected_issue=suspected,
            business_impact=impact,
            agent_trace=trace,
        )

    # ── Runtime / UI error ───────────────────────────────────────────────────
    if "error" in tl and "no error" not in tl:
        return TestResultPayload(
            test_case_id=case.id,
            status="fail",
            severity="medium",
            confidence=0.6,
            failed_step=case.steps[0] if case.steps else "Execute flow",
            expected="; ".join(case.expected_outcomes[:2]) or case.goal,
            actual="Trace mentions an error state — see agent trace for details.",
            repro_steps=case.steps[:6],
            evidence=evidence,
            suspected_issue="See agent trace for UI or runtime error hints.",
            business_impact="Feature may be unreliable for end users.",
            agent_trace=trace,
        )

    # ── Apparent pass ────────────────────────────────────────────────────────
    return TestResultPayload(
        test_case_id=case.id,
        status="pass",
        severity="low",
        confidence=0.62,
        failed_step=None,
        expected="; ".join(case.expected_outcomes[:2]) or case.goal,
        actual=f"Loaded: {page_title[:80]} — trace length {len(trace)} chars.",
        repro_steps=case.steps[:4] if case.steps else [f"Open {final_url}"],
        evidence=evidence,
        suspected_issue="",
        business_impact="No blocking issue detected by heuristics.",
        agent_trace=trace,
    )
