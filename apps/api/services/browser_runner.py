import os
from pathlib import Path

from models.schemas import TestCase


def _task_prompt(case: TestCase, url: str) -> str:
    return "\n".join(
        [
            "You are an autonomous QA agent executing ONE browser test.",
            f"Start URL: {url}",
            f"Test name: {case.name}",
            f"Goal: {case.goal}",
            "Preconditions: " + "; ".join(case.preconditions or ["Site reachable"]),
            "Follow these steps in order (adapt slightly if the UI blocks you; explain blockers):",
            *[f"{i+1}. {s}" for i, s in enumerate(case.steps or ["Open the start URL and explore the UI"])],
            "Expected outcomes: " + "; ".join(case.expected_outcomes or ["No critical breakage"]),
            "Failure signals to watch for: " + "; ".join(case.failure_signals or []),
            "Rules: prefer visible UI; after major actions note what you see; "
            "if login/MFA/captcha is required and not provided, stop with BLOCKED and why.",
            "End with a short RESULT line: PASS, FAIL, or BLOCKED and one-sentence rationale.",
        ]
    )


def _cloud_browser_use_available() -> bool:
    """Check if Browser Use Cloud API credentials are present."""
    return bool((os.getenv("BROWSER_USE_API_KEY") or "").strip())


def _local_browser_use_available() -> bool:
    """Check if local browser-use package + Gemini key are present."""
    if not os.getenv("GOOGLE_API_KEY"):
        return False
    try:
        import browser_use  # noqa: F401

        return True
    except ImportError:
        return False


def _browser_use_available() -> bool:
    return _cloud_browser_use_available() or _local_browser_use_available()


async def _run_browser_use_cloud_agent(case: TestCase, url: str) -> str:
    """Execute via Browser Use Cloud API (uses $70 sponsored credits)."""
    import asyncio

    from browser_use_sdk import AsyncBrowserUse

    key = (os.getenv("BROWSER_USE_API_KEY") or "").strip()
    client = AsyncBrowserUse(api_key=key)

    # Pick best available Gemini model via cloud (gemini-2.5-flash is fastest)
    cloud_llm = os.getenv("BROWSER_USE_CLOUD_LLM", "gemini-2.5-flash")

    created = await client.tasks.create_task(
        task=_task_prompt(case, url),
        start_url=url,
        llm=cloud_llm,  # type: ignore[arg-type]
        max_steps=20,
    )
    task_id = created.id

    # Poll status until terminal (max ~5 min at 2 s intervals)
    for _ in range(150):
        status_view = await client.tasks.get_task_status(task_id)
        if status_view.status in ("finished", "stopped"):
            break
        await asyncio.sleep(2)

    # Fetch full task details including step-by-step trace
    task_view = await client.tasks.get_task(task_id)

    parts: list[str] = [f"Browser Use Cloud task {task_id} | status: {task_view.status}"]
    for step in task_view.steps or []:
        parts.append(f"\nStep {step.number}: {step.next_goal}")
        if step.evaluation_previous_goal:
            parts.append(f"  ↳ eval: {step.evaluation_previous_goal}")
        if step.memory:
            parts.append(f"  ↳ memory: {step.memory[:200]}")

    if task_view.output:
        parts.append(f"\nFinal output: {task_view.output}")

    if task_view.is_success is not None:
        parts.append(f"Agent self-reported success: {task_view.is_success}")

    if task_view.judge_verdict:
        parts.append(f"Judge verdict: {task_view.judge_verdict}")

    return "\n".join(parts)


async def _run_browser_use_local_agent(case: TestCase, url: str) -> str:
    """Fallback: execute via local browser-use package with Gemini LLM."""
    from browser_use import Agent
    from langchain_google_genai import ChatGoogleGenerativeAI

    llm = ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_AGENT_MODEL", "gemini-2.0-flash"),
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0.0,
    )
    agent = Agent(
        task=_task_prompt(case, url),
        llm=llm,
    )
    result = await agent.run()
    if result is None:
        return "Agent completed with no return payload."
    return str(result)


async def _run_browser_use_agent(case: TestCase, url: str) -> str:
    """Dispatch to cloud API if available, otherwise fall back to local agent."""
    if _cloud_browser_use_available():
        return await _run_browser_use_cloud_agent(case, url)
    return await _run_browser_use_local_agent(case, url)


async def _run_playwright_smoke(
    url: str,
    viewport: str,
    shot_path: Path,
    video_dir: Path,
) -> tuple[str, str, str, bool, str | None]:
    from playwright.async_api import async_playwright

    vw, vh = (1280, 720) if viewport == "desktop" else (390, 844)
    trace_parts: list[str] = []
    http_ok = True
    final_url = url
    title = ""
    video_path_raw: str | None = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                viewport={"width": vw, "height": vh},
                record_video_dir=str(video_dir),
                record_video_size={"width": vw, "height": vh},
            )
            page = await context.new_page()
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            if resp is not None:
                status_code = resp.status
                http_ok = 200 <= status_code < 400
                trace_parts.append(f"HTTP status: {status_code}")
                # Surface blocking responses explicitly so the validator can classify them
                if status_code == 403:
                    trace_parts.append("BLOCKED: server returned 403 Forbidden — likely bot/WAF block")
                elif status_code == 429:
                    trace_parts.append("BLOCKED: server returned 429 Too Many Requests — rate limited")
                elif status_code >= 500:
                    trace_parts.append(f"SERVER ERROR: {status_code} — upstream service failure")
                elif not http_ok:
                    trace_parts.append(f"HTTP ERROR: {status_code}")
            await page.wait_for_timeout(800)
            title = await page.title()
            final_url = page.url
            trace_parts.append(f"Title: {title}")
            trace_parts.append(f"Final URL: {final_url}")

            # Detect bot-challenge pages that return HTTP 200 but show a block screen
            page_text = (await page.inner_text("body") if await page.query_selector("body") else "").lower()
            if any(kw in page_text for kw in ("captcha", "verify you are human", "cloudflare", "access denied", "bot detection", "ddos protection")):
                trace_parts.append("BLOCKED: page content indicates a bot-challenge or WAF interstitial (Cloudflare/CAPTCHA)")

            try:
                await page.screenshot(path=str(shot_path), full_page=False)
                trace_parts.append(f"Screenshot saved: {shot_path.name}")
            except Exception as ss_err:
                trace_parts.append(f"Screenshot failed: {ss_err!s}")

            # Must retrieve video path BEFORE context.close() finalises the file
            if page.video:
                try:
                    video_path_raw = await page.video.path()
                except Exception:
                    video_path_raw = None
        except Exception as e:
            http_ok = False
            err_str = str(e)
            # Classify common Playwright navigation errors with actionable messages
            if "net::ERR_NAME_NOT_RESOLVED" in err_str or "ERR_NAME_NOT_FOUND" in err_str:
                trace_parts.append(f"NETWORK ERROR: DNS resolution failed — '{url}' could not be resolved. Check the URL.")
            elif "net::ERR_CONNECTION_REFUSED" in err_str:
                trace_parts.append(f"NETWORK ERROR: Connection refused — server at '{url}' is not accepting connections.")
            elif "net::ERR_CONNECTION_TIMED_OUT" in err_str or "Timeout" in err_str:
                trace_parts.append(f"NETWORK ERROR: Connection timed out navigating to '{url}'.")
            elif "net::ERR_SSL" in err_str:
                trace_parts.append(f"NETWORK ERROR: SSL/TLS error navigating to '{url}': {err_str[:200]}")
            elif "Cannot navigate to invalid URL" in err_str:
                trace_parts.append(f"NETWORK ERROR: Invalid URL '{url}' — missing scheme (http/https)?")
            else:
                trace_parts.append(f"PLAYWRIGHT ERROR: {err_str[:400]}")
        finally:
            try:
                await context.close()  # finalises the .webm recording
            except Exception:
                pass
            await browser.close()

    return "\n".join(trace_parts), title, final_url, http_ok, video_path_raw


async def execute_case(
    case: TestCase,
    url: str,
    viewport: str,
    run_id: str,
    base_dir: Path,
) -> tuple[str, str, str, list[str], bool]:
    """
    Returns: trace, page_title, final_url, evidence_rel_paths, http_ok
    """
    case_dir = base_dir / case.id
    case_dir.mkdir(parents=True, exist_ok=True)
    evidence: list[str] = []

    shot = case_dir / "viewport.png"
    pw_trace, title, final_url, http_ok, video_path_raw = await _run_playwright_smoke(
        url, viewport, shot, video_dir=case_dir
    )
    evidence.append(f"/files/{run_id}/{case.id}/viewport.png")

    # Rename Playwright's UUID-named video to a stable path and add to evidence
    if video_path_raw:
        try:
            raw = Path(video_path_raw)
            if raw.exists():
                dest = case_dir / "recording.webm"
                raw.rename(dest)
                evidence.append(f"/files/{run_id}/{case.id}/recording.webm")
        except Exception:
            pass

    if _browser_use_available():
        try:
            bu_trace = await _run_browser_use_agent(case, url)
            combined = f"--- Playwright snapshot ---\n{pw_trace}\n\n--- Browser Use agent ---\n{bu_trace}"
            agent_log = case_dir / "agent_trace.txt"
            agent_log.write_text(combined, encoding="utf-8")
            evidence.append(f"/files/{run_id}/{case.id}/agent_trace.txt")
            return combined, title, final_url, evidence, http_ok
        except Exception as e:
            err = f"{pw_trace}\n\nBrowser Use error: {e!s}"
            return err, title, final_url, evidence, http_ok

    return pw_trace, title, final_url, evidence, http_ok
